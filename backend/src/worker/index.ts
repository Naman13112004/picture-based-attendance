// src/worker/index.ts
// Standalone worker process — separate from the Express API server.
//
// This process:
//   1. Creates a BullMQ Worker subscribed to the "attendance" queue.
//   2. Processes one job at a time (concurrency 1 by default; configurable
//      via WORKER_CONCURRENCY env var).
//   3. Listens for SIGTERM / SIGINT to perform a graceful shutdown —
//      waits for any in-flight job to complete before exiting.
//   4. Recovers automatically after restart: BullMQ re-queues stalled jobs
//      (jobs that were ACTIVE when the worker crashed) after a configurable
//      lock expiry (default 30 s).
//
// In Docker Compose this runs as a separate container using the same backend
// image but overriding CMD to: node dist/worker/index.js

import 'dotenv/config';
import { Worker } from 'bullmq';
import { createRedisConnection, ATTENDANCE_QUEUE } from '../queues/attendanceQueue.js';
import { processAttendanceJob } from './attendanceProcessor.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY ?? '1', 10);
const STALLED_INTERVAL_MS = parseInt(process.env.WORKER_STALLED_INTERVAL_MS ?? '30000', 10);

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

const workerConnection = createRedisConnection();

const worker = new Worker(
  ATTENDANCE_QUEUE,
  processAttendanceJob,
  {
    connection: workerConnection,
    concurrency: CONCURRENCY,
    // StalledJobsChecker: reclaim jobs stuck in ACTIVE state (e.g. after a crash).
    // lockDuration must be > the longest expected job execution time (default 30 s here).
    lockDuration: STALLED_INTERVAL_MS,
  },
);

// ---------------------------------------------------------------------------
// Lifecycle logging
// ---------------------------------------------------------------------------

worker.on('active', (job) => {
  console.log(`[Worker] Job active: ${job.id} (attempt ${job.attemptsMade + 1})`);
});

worker.on('completed', (job) => {
  console.log(`[Worker] Job completed: ${job.id}`);
});

worker.on('failed', (job, err) => {
  const id = job?.id ?? 'unknown';
  const attempts = job?.attemptsMade ?? 0;
  const maxAttempts = job?.opts.attempts ?? 3;
  if (attempts >= maxAttempts) {
    console.error(`[Worker] Job DEAD (all ${maxAttempts} attempts exhausted): ${id} — ${err.message}`);
  } else {
    console.warn(`[Worker] Job failed (will retry): ${id} — ${err.message}`);
  }
});

worker.on('error', (err) => {
  console.error('[Worker] Worker error:', err.message);
});

worker.on('stalled', (jobId) => {
  console.warn(`[Worker] Stalled job reclaimed: ${jobId}`);
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

console.log(
  `[Worker] SnapAttend attendance worker started. ` +
  `Queue: "${ATTENDANCE_QUEUE}", Concurrency: ${CONCURRENCY}`,
);

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`[Worker] Received ${signal} — waiting for in-flight jobs to complete...`);
  try {
    // close(true) waits for the current job to finish before closing.
    await worker.close();
    await workerConnection.quit();
    console.log('[Worker] Graceful shutdown complete.');
  } catch (err) {
    console.error('[Worker] Error during shutdown:', err);
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', () => { void gracefulShutdown('SIGTERM'); });
process.on('SIGINT',  () => { void gracefulShutdown('SIGINT'); });

// Catch unhandled rejections so the process doesn't silently die.
process.on('unhandledRejection', (reason) => {
  console.error('[Worker] Unhandled rejection:', reason);
});
