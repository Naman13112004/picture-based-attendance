-- Migration: add_pgvector_and_jobs
-- Enables the pgvector extension, adds a native vector column to StudentProfile
-- for fast cosine similarity search, and creates the AttendanceJob table for
-- async attendance processing lifecycle tracking.

-- ---------------------------------------------------------------------------
-- Step 1: Enable pgvector extension
-- ---------------------------------------------------------------------------
-- Requires Neon PostgreSQL (which bundles pgvector). Safe to run even if
-- the extension is already enabled — IF NOT EXISTS makes this idempotent.
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- Step 2: Add faceVector column to StudentProfile
-- ---------------------------------------------------------------------------
-- Stores the primary (first) 128-D SFace embedding as a native pgvector type.
-- Populated in addition to the existing faceEmbedding (Json) column when a
-- student uploads their face photos. The Json column is kept for backward
-- compatibility with the existing Python matching code (deprecated, will be
-- removed once pgvector matching is fully in production).
ALTER TABLE "StudentProfile"
    ADD COLUMN IF NOT EXISTS "faceVector" vector(128);

-- ---------------------------------------------------------------------------
-- Step 3: Create HNSW index for fast cosine similarity search
-- ---------------------------------------------------------------------------
-- HNSW (Hierarchical Navigable Small World) provides O(log N) approximate
-- nearest-neighbour queries. vector_cosine_ops instructs pgvector to use
-- cosine distance for the index — matching the SFace model's similarity metric.
-- ef_construction=64, m=16 are sensible defaults for 128-D vectors at
-- hundreds-of-students scale (good recall, fast build time).
CREATE INDEX IF NOT EXISTS "StudentProfile_faceVector_hnsw_idx"
    ON "StudentProfile"
    USING hnsw ("faceVector" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ---------------------------------------------------------------------------
-- Step 4: Create JobStatus enum
-- ---------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE "JobStatus" AS ENUM (
        'QUEUED',
        'PROCESSING',
        'COMPLETED',
        'FAILED',
        'DEAD'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- Step 5: Create AttendanceJob table
-- ---------------------------------------------------------------------------
-- Tracks the full lifecycle of an async attendance-processing job.
-- One row is created per teacher attendance submission. The BullMQ worker
-- updates this row as it processes the job (QUEUED → PROCESSING → COMPLETED
-- or FAILED → DEAD after maxAttempts).
CREATE TABLE IF NOT EXISTS "AttendanceJob" (
    "id"          TEXT            NOT NULL,
    "classId"     TEXT            NOT NULL,
    "teacherId"   TEXT            NOT NULL,
    -- Supabase Storage public URL of the uploaded classroom photo.
    "imageUrl"    TEXT            NOT NULL,
    -- YYYY-MM-DD local date string from the teacher's client.
    "date"        TEXT            NOT NULL,
    "status"      "JobStatus"     NOT NULL DEFAULT 'QUEUED',
    -- Number of processing attempts made (incremented on each failure).
    "attempts"    INTEGER         NOT NULL DEFAULT 0,
    -- Maximum attempts before the job is moved to DEAD state.
    "maxAttempts" INTEGER         NOT NULL DEFAULT 3,
    -- Human-readable description of the last failure.
    "lastError"   TEXT,
    -- JSON result blob once COMPLETED.
    -- Shape: { total_faces_detected, present_student_ids, absent_count, warning? }
    "result"      JSONB,
    "createdAt"   TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceJob_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- Step 6: Foreign keys for AttendanceJob
-- ---------------------------------------------------------------------------
DO $$ BEGIN
    ALTER TABLE "AttendanceJob"
        ADD CONSTRAINT "AttendanceJob_classId_fkey"
        FOREIGN KEY ("classId")
        REFERENCES "Classroom"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "AttendanceJob"
        ADD CONSTRAINT "AttendanceJob_teacherId_fkey"
        FOREIGN KEY ("teacherId")
        REFERENCES "User"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- Step 7: Indexes for AttendanceJob
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "AttendanceJob_classId_idx"
    ON "AttendanceJob"("classId");

CREATE INDEX IF NOT EXISTS "AttendanceJob_teacherId_idx"
    ON "AttendanceJob"("teacherId");

CREATE INDEX IF NOT EXISTS "AttendanceJob_status_idx"
    ON "AttendanceJob"("status");

CREATE INDEX IF NOT EXISTS "AttendanceJob_createdAt_idx"
    ON "AttendanceJob"("createdAt");

-- Composite index for duplicate-job lookup:
-- "Is there already a non-DEAD job for this classroom on this date?"
CREATE INDEX IF NOT EXISTS "AttendanceJob_classId_date_status_idx"
    ON "AttendanceJob"("classId", "date", "status");

-- ---------------------------------------------------------------------------
-- Step 8: updatedAt trigger for AttendanceJob
-- ---------------------------------------------------------------------------
-- Automatically keeps updatedAt in sync on every row update.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    CREATE TRIGGER "AttendanceJob_updatedAt_trigger"
        BEFORE UPDATE ON "AttendanceJob"
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
