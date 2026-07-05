-- Migration: add-face-embedding
-- Adds the faceEmbedding column to StudentProfile as JSONB.
-- Stores up to 3 pre-computed, L2-normalized SFace 128-D embedding vectors
-- as a number[][] JSON array. NULL means the student has no registered embedding.

ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "faceEmbedding" JSONB;
