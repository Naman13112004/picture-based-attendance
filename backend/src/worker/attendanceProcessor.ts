// src/worker/attendanceProcessor.ts
// Core job processing logic for the async attendance pipeline.
//
// Phase 5 architecture (pgvector path):
//   1. Mark AttendanceJob as PROCESSING in the DB.
//   2. Load classroom + enrolled student IDs (NOT their embeddings).
//   3. Fetch the classroom photo from Supabase Storage (→ base64).
//   4. Call FastAPI /extract-embeddings → get raw face embeddings only.
//   5. For each detected face, run a pgvector cosine-distance query
//      against enrolled students who have a faceVector registered.
//   6. Resolve face→student matches (greedy by closest distance).
//   7. Bulk-insert attendance records in a transaction.
//   8. Mark AttendanceJob COMPLETED.
//   On failure: FAILED / DEAD + re-throw for BullMQ retry.
//
// Why pgvector instead of in-memory matching (old /recognize endpoint)?
//   • Payload: O(faces × 128) instead of O(students × faces × 128).
//   • Student embeddings never leave the database tier.
//   • Matching leverages the HNSW index, scales with DB not worker count.

import type { Job } from 'bullmq';
import axios from 'axios';
import { Prisma } from '@prisma/client';
import db from '../config/db.js';
import { extractFaceEmbeddings } from '../services/aiService.js';
import type { AttendanceJobData } from '../queues/attendanceQueue.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Cosine distance threshold for a face→student match.
 * pgvector's <=> operator returns cosine distance in [0, 2]:
 *   0.0 = identical vectors
 *   2.0 = completely opposite vectors
 *
 * Empirically, SFace embeddings of the same person are typically < 0.3,
 * and different people are typically > 0.6. A threshold of 0.5 gives a
 * comfortable margin. Tune via env var without redeploying.
 */
const SIMILARITY_THRESHOLD = parseFloat(
  process.env.PGVECTOR_SIMILARITY_THRESHOLD ?? '0.5',
);

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const logger = {
  info: (msg: string, ...args: unknown[]) => console.log(`[Worker]  ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) => console.warn(`[Worker]  ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) => console.error(`[Worker]  ${msg}`, ...args),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a YYYY-MM-DD string to UTC midnight Date.
 * Matches the canonical form used by all attendance date columns.
 */
function toUtcMidnight(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/**
 * Fetch an image from a public Supabase URL and return it as a base64
 * data URI string — the format FastAPI /extract-embeddings expects.
 */
async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: 30_000,
  });
  const contentType =
    (response.headers['content-type'] as string | undefined) ?? 'image/jpeg';
  return `data:${contentType};base64,${Buffer.from(response.data).toString('base64')}`;
}

/**
 * Row returned by the pgvector cosine-distance query.
 * Prisma's $queryRawUnsafe maps snake_case column aliases automatically.
 */
interface VectorMatchRow {
  userId: string;
  distance: number;
}

/**
 * For a single detected face embedding, find the closest enrolled student
 * who has a faceVector registered, using the HNSW index.
 *
 * Only students in `enrolledIds` are considered (WHERE clause).
 * Returns null if no match is within SIMILARITY_THRESHOLD.
 *
 * @param embedding     128-D face embedding from AI service.
 * @param enrolledIds   UUIDs of enrolled students who have faceVector set.
 */
async function findClosestStudent(
  embedding: number[],
  enrolledIds: string[],
): Promise<VectorMatchRow | null> {
  if (enrolledIds.length === 0) return null;

  // Build the pgvector literal: [f1,f2,...,f128]
  // Safe to interpolate directly — values are AI-extracted floats, not user input.
  const vectorLiteral = `[${embedding.join(',')}]`;

  const rows = await db.$queryRawUnsafe<VectorMatchRow[]>(
    `SELECT sp."userId", (sp."faceVector" <=> $1::vector)::float8 AS distance
     FROM "StudentProfile" sp
     WHERE sp."userId" = ANY($2::text[])
       AND sp."faceVector" IS NOT NULL
     ORDER BY distance ASC
     LIMIT 1`,
    vectorLiteral,
    enrolledIds,
  );

  if (rows.length === 0 || rows[0]!.distance >= SIMILARITY_THRESHOLD) return null;
  return rows[0]!;
}

// ---------------------------------------------------------------------------
// Main processor
// ---------------------------------------------------------------------------

/**
 * BullMQ processor function — called once per job attempt.
 *
 * DB status lifecycle mirrors BullMQ retry states:
 *   Start of each attempt → PROCESSING
 *   Success              → COMPLETED
 *   Failure, retries     → FAILED
 *   Last attempt done    → DEAD
 */
export async function processAttendanceJob(job: Job<AttendanceJobData>): Promise<void> {
  const { jobDbId, classId, teacherId, date } = job.data;
  const correlationId = `job:${jobDbId}`;

  logger.info(`[${correlationId}] Starting attempt ${job.attemptsMade + 1}`, {
    classId, teacherId, date,
  });

  // ── Step 1: Mark as PROCESSING ────────────────────────────────────────────
  const dbJob = await db.attendanceJob.update({
    where: { id: jobDbId },
    data: {
      status: 'PROCESSING',
      attempts: { increment: 1 },
    },
  });

  try {
    // ── Step 2: Load classroom + enrolled student IDs (no embeddings) ─────
    const classroom = await db.classroom.findUnique({
      where: { id: classId },
      include: {
        students: { select: { userId: true } },
      },
    });

    if (!classroom) {
      throw new Error(`Classroom ${classId} not found — it may have been deleted.`);
    }
    if (classroom.teacherId !== teacherId) {
      throw new Error(`Teacher ${teacherId} does not own classroom ${classId}.`);
    }

    const allStudentIds = classroom.students.map((s) => s.userId);
    const attendanceDate = toUtcMidnight(date);

    // ── Step 3: Idempotency guard ─────────────────────────────────────────
    const existingCount = await db.attendance.count({
      where: { classId, date: attendanceDate },
    });
    if (existingCount > 0) {
      logger.warn(`[${correlationId}] Attendance for ${date} already exists — idempotency skip.`);
      await db.attendanceJob.update({
        where: { id: jobDbId },
        data: {
          status: 'COMPLETED',
          result: {
            message: `Attendance for ${date} was already recorded (idempotency skip).`,
            total_faces_detected: 0,
            present_count: 0,
            absent_count: 0,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      return;
    }

    // ── Step 4: Fetch classroom image from Supabase ───────────────────────
    logger.info(`[${correlationId}] Fetching classroom image: ${dbJob.imageUrl}`);
    const classImageBase64 = await fetchImageAsBase64(dbJob.imageUrl);

    // ── Step 5: Extract face embeddings via FastAPI ───────────────────────
    // New pgvector path: we only send the classroom image, NOT student data.
    let faceEmbeddings: number[][] = [];
    let totalFacesDetected = 0;

    // Determine which enrolled students have a faceVector registered in the DB.
    // We run this query before calling AI to skip the AI call entirely if none
    // of the enrolled students have been face-registered yet.
    const studentsWithVector = await db.$queryRawUnsafe<Array<{ userId: string }>>(
      `SELECT sp."userId"
       FROM "StudentProfile" sp
       WHERE sp."userId" = ANY($1::text[])
         AND sp."faceVector" IS NOT NULL`,
      allStudentIds,
    ) as Array<{ userId: string }>;

    const enrolledIdsWithVector = studentsWithVector.map((r) => r.userId);
    const studentIdsWithoutVector = allStudentIds.filter(
      (id) => !enrolledIdsWithVector.includes(id),
    );

    if (studentIdsWithoutVector.length > 0) {
      logger.warn(
        `[${correlationId}] ${studentIdsWithoutVector.length} student(s) have no faceVector — will be ABSENT.`,
      );
    }

    if (enrolledIdsWithVector.length > 0) {
      logger.info(
        `[${correlationId}] Calling AI /extract-embeddings (${enrolledIdsWithVector.length} students with vectors).`,
      );
      const aiResult = await extractFaceEmbeddings(classImageBase64);
      faceEmbeddings = aiResult.embeddings;
      totalFacesDetected = aiResult.face_count;
      logger.info(`[${correlationId}] AI detected ${totalFacesDetected} face(s).`);
    } else {
      logger.warn(`[${correlationId}] No enrolled students have faceVector — skipping AI call.`);
    }

    // ── Step 6: pgvector matching ─────────────────────────────────────────
    // For each detected face, find the closest enrolled student using the HNSW index.
    // Strategy: greedy by distance — sort all candidate matches ascending by distance,
    // assign each student to at most one face (the closest one).

    interface FaceMatch {
      faceIndex: number;
      studentId: string;
      distance: number;
    }

    const candidateMatches: FaceMatch[] = [];

    for (let i = 0; i < faceEmbeddings.length; i++) {
      const match = await findClosestStudent(faceEmbeddings[i]!, enrolledIdsWithVector);
      if (match) {
        candidateMatches.push({
          faceIndex: i,
          studentId: match.userId,
          distance: match.distance,
        });
        logger.info(
          `[${correlationId}] Face[${i}] → student ${match.userId} (distance=${match.distance.toFixed(4)})`,
        );
      } else {
        logger.info(`[${correlationId}] Face[${i}] → no match within threshold ${SIMILARITY_THRESHOLD}`);
      }
    }

    // Sort by distance ascending, then deduplicate students (keep closest face per student)
    candidateMatches.sort((a, b) => a.distance - b.distance);
    const presentStudentIds = new Set<string>();
    for (const match of candidateMatches) {
      if (!presentStudentIds.has(match.studentId)) {
        presentStudentIds.add(match.studentId);
      }
    }

    logger.info(
      `[${correlationId}] Matching complete: ${presentStudentIds.size} present ` +
      `out of ${allStudentIds.length} enrolled.`,
    );

    // ── Step 7: Bulk-insert attendance rows ───────────────────────────────
    const attendanceData = allStudentIds.map((studentId) => ({
      date: attendanceDate,
      status: presentStudentIds.has(studentId) ? ('PRESENT' as const) : ('ABSENT' as const),
      studentId,
      classId,
    }));

    await db.$transaction(async (tx) => {
      await tx.attendance.createMany({
        data: attendanceData,
        skipDuplicates: true,
      });
    });

    logger.info(`[${correlationId}] Attendance saved.`);

    // ── Step 8: Build result payload ──────────────────────────────────────
    const resultPayload: Record<string, unknown> = {
      total_faces_detected: totalFacesDetected,
      present_student_ids: [...presentStudentIds],
      present_count: presentStudentIds.size,
      absent_count: allStudentIds.length - presentStudentIds.size,
    };

    if (studentIdsWithoutVector.length > 0) {
      resultPayload['warning'] =
        `${studentIdsWithoutVector.length} enrolled student(s) have no registered ` +
        `face embeddings and were automatically marked absent.`;
      resultPayload['students_without_embeddings'] = studentIdsWithoutVector;
    }

    // ── Step 9: Mark COMPLETED ────────────────────────────────────────────
    await db.attendanceJob.update({
      where: { id: jobDbId },
      data: {
        status: 'COMPLETED',
        result: resultPayload as unknown as Prisma.InputJsonValue,
        lastError: null,
      },
    });

    logger.info(`[${correlationId}] Job COMPLETED.`);

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const currentAttempt = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? 3;
    const isLastAttempt = currentAttempt >= maxAttempts;

    logger.error(
      `[${correlationId}] Attempt ${currentAttempt}/${maxAttempts} failed: ${errorMessage}`,
    );

    await db.attendanceJob.update({
      where: { id: jobDbId },
      data: {
        status: isLastAttempt ? 'DEAD' : 'FAILED',
        lastError: errorMessage,
      },
    }).catch((updateErr: unknown) => {
      logger.error(`[${correlationId}] Failed to update DB job status:`, updateErr);
    });

    throw err; // Re-throw so BullMQ schedules the next retry
  }
}
