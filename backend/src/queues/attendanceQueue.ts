// src/queues/attendanceQueue.ts
// Centralised BullMQ queue definition for async attendance processing.
// Both the API server (producer) and the worker process (consumer) import
// this module to share queue name, connection settings, and job options.

import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

// ---------------------------------------------------------------------------
// Redis connection factory
// ---------------------------------------------------------------------------

/**
 * Creates an ioredis connection configured for Upstash compatibility.
 *
 * Key settings:
 *   maxRetriesPerRequest: null — required by BullMQ; prevents "Max retries
 *     per request limit exceeded" for long-running blocking calls.
 *   enableReadyCheck: false — Upstash connections don't always pass the READY
 *     state check; disabling prevents premature connection failures.
 *
 * The REDIS_URL must use the rediss:// or redis:// scheme. Upstash provides
 * URLs of the form: rediss://default:<TOKEN>@<HOST>.upstash.io:<PORT>
 *
 * @throws If REDIS_URL is not set in the environment.
 */
export function createRedisConnection(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      'REDIS_URL is not set. ' +
      'Add your Upstash Redis URL (rediss://...) to the .env file.',
    );
  }
  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

// ---------------------------------------------------------------------------
// Queue name constant (shared between producer and consumer)
// ---------------------------------------------------------------------------

export const ATTENDANCE_QUEUE = 'attendance';

// ---------------------------------------------------------------------------
// Job data type
// ---------------------------------------------------------------------------

/**
 * Data stored in the BullMQ job payload.
 * Intentionally minimal — heavy data (imageUrl, embeddings) is loaded
 * from the database inside the worker to avoid bloating Redis memory.
 */
export interface AttendanceJobData {
  /** UUID of the AttendanceJob row in PostgreSQL (used to load all metadata). */
  jobDbId: string;
  /** Classroom UUID — duplicated here for quick logging without a DB round-trip. */
  classId: string;
  /** Teacher UUID — for ownership validation inside the worker. */
  teacherId: string;
  /** YYYY-MM-DD date string (teacher's local date). */
  date: string;
}

// ---------------------------------------------------------------------------
// Lazy queue initialisation
// ---------------------------------------------------------------------------
// The Queue is created on first use rather than at module load time.
// This allows the Express API server to start and serve other endpoints
// (auth, classroom CRUD, etc.) even when REDIS_URL is not yet configured.
// The error is surfaced only when the teacher submits the first attendance
// request, making local development without Upstash much smoother.

let _queue: Queue<AttendanceJobData> | null = null;

/**
 * Returns the singleton BullMQ Queue, initialising it on first call.
 *
 * Retry policy:
 *   - 3 total attempts (1 initial + 2 retries)
 *   - Exponential backoff starting at 1 000 ms: 1 s → 2 s → 4 s
 *   - After exhausting all attempts the job is moved to the BullMQ failed
 *     set and the AttendanceJob DB row is set to DEAD.
 *
 * Retention:
 *   - Completed jobs: keep the last 100 in Redis (for debugging).
 *   - Failed jobs: keep the last 200 in Redis.
 *
 * @throws If REDIS_URL is not set in the environment.
 */
export function getAttendanceQueue(): Queue<AttendanceJobData> {
  if (_queue) return _queue;

  _queue = new Queue<AttendanceJobData>(ATTENDANCE_QUEUE, {
    connection: createRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  });

  return _queue;
}

// ---------------------------------------------------------------------------
// Helper: enqueue a job with built-in deduplication
// ---------------------------------------------------------------------------

/**
 * Add an attendance job to the queue with a deterministic BullMQ job ID.
 *
 * Deduplication strategy:
 *   BullMQ treats `jobId` as a unique key within the queue. If a job with
 *   the same ID already exists in WAITING or ACTIVE state, adding it again
 *   is a no-op. This prevents duplicate processing when a teacher submits
 *   the same classroom photo twice in quick succession.
 *
 *   The application-level duplicate check in the API controller (checking
 *   for a non-FAILED/DEAD AttendanceJob row) provides the primary guard.
 *   This BullMQ-level deduplication is a secondary safety net.
 *
 * @param data   Job payload (see AttendanceJobData).
 * @returns      The BullMQ Job object.
 */
export async function enqueueAttendanceJob(data: AttendanceJobData) {
  const queue = getAttendanceQueue();
  const bullJobId = `attendancejob-${data.jobDbId}`;
  return queue.add('process-attendance', data, { jobId: bullJobId });
}
