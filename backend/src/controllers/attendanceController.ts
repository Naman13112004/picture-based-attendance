// src/controllers/attendanceController.ts
import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/authMiddleware.js';
import db from '../config/db.js';
import { recognizeFaces } from '../services/aiService.js';
import type { StudentEmbeddingPayload } from '../types/ai.js';
import { saveClassroomImage } from '../utils/fileHelper.js';
import { enqueueAttendanceJob } from '../queues/attendanceQueue.js';

// ---------------------------------------------------------------------------
// Helpers  (shared internally — unchanged from original)
// ---------------------------------------------------------------------------

/**
 * Safely parse the faceEmbedding JSONB column into a typed number[][].
 * Returns null if the value is absent, structurally wrong, or wrong dimension.
 */
function parseFaceEmbedding(raw: unknown): number[][] | null {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return null;
  const valid = (raw as unknown[]).every(
    (vec) =>
      Array.isArray(vec) &&
      (vec as unknown[]).length === 128 &&
      (vec as unknown[]).every((n) => typeof n === 'number'),
  );
  return valid ? (raw as number[][]) : null;
}

/**
 * Convert a YYYY-MM-DD string (teacher's local date) to a UTC midnight Date.
 * This is the canonical form stored in the DB so the unique constraint
 * @@unique([studentId, classId, date]) works per calendar day.
 */
function toUtcMidnight(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/** Today's UTC date as YYYY-MM-DD — fallback when the client omits `date`. */
function todayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// markAttendance  ← ASYNC (Phase 3 refactor)
// ---------------------------------------------------------------------------

/**
 * POST /api/attendance/mark
 *
 * Accepts a classroom photo and returns immediately (HTTP 202) after:
 *   1. Validating the payload and classroom ownership.
 *   2. Checking for an existing active job (duplicate guard).
 *   3. Uploading the classroom photo to Supabase (classroom-photos bucket).
 *   4. Creating an AttendanceJob row in PostgreSQL with status QUEUED.
 *   5. Enqueuing the job in BullMQ for the worker to process asynchronously.
 *
 * The caller receives a `jobId` immediately and should poll
 * GET /api/attendance/job/:jobId/stream (SSE) for real-time status updates.
 *
 * HTTP Responses:
 *   202  — Job accepted and queued.
 *   400  — Missing or invalid payload.
 *   403  — Teacher does not own the classroom.
 *   404  — Classroom not found.
 *   409  — An active job already exists for this classroom + date.
 *   500  — Server-side error (upload, DB, or queue failure).
 */
export const markAttendance = async (req: AuthRequest, res: Response) => {
  try {
    const { classId, image, date } = req.body as {
      classId?: unknown;
      image?: unknown;
      date?: unknown;
    };

    // ── Validate payload ──────────────────────────────────────────────────────
    if (typeof classId !== 'string' || !classId.trim()) {
      return res.status(400).json({ message: 'classId is required.' });
    }
    if (typeof image !== 'string' || !image.trim()) {
      return res.status(400).json({
        message: 'image is required and must be a non-empty Base64 string.',
      });
    }

    // Resolve date: use client-supplied YYYY-MM-DD or fall back to today UTC
    const dateStr =
      typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date
        : todayUtcDateString();

    // ── Step 1: Load classroom + verify ownership ─────────────────────────────
    const classroom = await db.classroom.findUnique({ where: { id: classId } });

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found.' });
    }
    if (classroom.teacherId !== req.user!.userId) {
      return res.status(403).json({
        message: 'You do not have permission to mark attendance for this classroom.',
      });
    }

    // ── Step 2: Duplicate-job guard ───────────────────────────────────────────
    // Reject if a non-terminal job already exists for this (classId, date) pair.
    // FAILED and DEAD jobs are excluded so that a teacher can retry a failed attempt.
    const existingJob = await db.attendanceJob.findFirst({
      where: {
        classId,
        date: dateStr,
        status: { notIn: ['FAILED', 'DEAD'] },
      },
      select: { id: true, status: true },
    });

    if (existingJob) {
      const statusLabel = existingJob.status.toLowerCase();
      return res.status(409).json({
        message:
          `Attendance for ${dateStr} is already ${statusLabel} for this classroom. ` +
          (existingJob.status === 'COMPLETED'
            ? 'Use "Manual Attendance" to make corrections.'
            : 'Check the existing job status.'),
        jobId: existingJob.id,
        status: existingJob.status,
      });
    }

    // ── Step 3: Upload classroom photo to Supabase ────────────────────────────
    // Store the image in the classroom-photos bucket before enqueueing so
    // the worker can download it without keeping the large base64 payload in Redis.
    let imageUrl: string;
    try {
      // Filename: classrooms/<classId>/<YYYY-MM-DD>-<epoch>.jpg
      // The epoch suffix prevents collisions on the same day (retries, etc.).
      const filename = `${dateStr}-${Date.now()}.jpg`;
      imageUrl = await saveClassroomImage(image, classId, filename);
    } catch (uploadErr) {
      console.error('[Attendance] Supabase upload failed:', uploadErr);
      return res.status(500).json({
        message:
          'Failed to upload the classroom photo. Please try again.',
      });
    }

    // ── Step 4: Create AttendanceJob row in DB ────────────────────────────────
    const attendanceJob = await db.attendanceJob.create({
      data: {
        classId,
        teacherId: req.user!.userId,
        imageUrl,
        date: dateStr,
        status: 'QUEUED',
      },
    });

    // ── Step 5: Enqueue into BullMQ ───────────────────────────────────────────
    try {
      await enqueueAttendanceJob({
        jobDbId: attendanceJob.id,
        classId,
        teacherId: req.user!.userId,
        date: dateStr,
      });
    } catch (queueErr) {
      // Queue failure: clean up the DB row so the teacher can retry immediately.
      await db.attendanceJob
        .delete({ where: { id: attendanceJob.id } })
        .catch(() => void 0); // best-effort cleanup
      console.error('[Attendance] BullMQ enqueue failed:', queueErr);
      return res.status(503).json({
        message:
          'The queue service is unavailable. ' +
          'Check REDIS_URL configuration and try again.',
      });
    }

    // ── Return 202 Accepted ───────────────────────────────────────────────────
    return res.status(202).json({
      message: 'Attendance processing has started. Track progress via the job stream.',
      jobId: attendanceJob.id,
      status: 'QUEUED',
      date: dateStr,
    });

  } catch (error) {
    console.error('[Attendance] markAttendance error:', error);
    return res.status(500).json({ message: 'Error processing attendance.' });
  }
};

// ---------------------------------------------------------------------------
// getJobStatus  ← NEW (Phase 3)
// ---------------------------------------------------------------------------

/**
 * GET /api/attendance/job/:jobId
 *
 * Returns the current state of an AttendanceJob.
 * Protected by authenticate + requireRole('TEACHER').
 * The requesting teacher must own the job (teacherId === req.user.userId).
 *
 * HTTP Responses:
 *   200  — Job found; returns id, status, attempts, lastError, result, date.
 *   403  — Teacher does not own this job.
 *   404  — Job not found.
 */
export const getJobStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { jobId } = req.params;

    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json({ message: 'jobId is required.' });
    }

    const job = await db.attendanceJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        classId: true,
        teacherId: true,
        date: true,
        status: true,
        attempts: true,
        maxAttempts: true,
        lastError: true,
        result: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    if (job.teacherId !== req.user!.userId) {
      return res.status(403).json({
        message: 'You do not have permission to view this job.',
      });
    }

    return res.json(job);

  } catch (error) {
    console.error('[Attendance] getJobStatus error:', error);
    return res.status(500).json({ message: 'Failed to fetch job status.' });
  }
};

// ---------------------------------------------------------------------------
// streamJobStatus  ← NEW (Phase 3)  — Server-Sent Events
// ---------------------------------------------------------------------------

/**
 * GET /api/attendance/job/:jobId/stream
 *
 * Server-Sent Events (SSE) endpoint that pushes real-time AttendanceJob status
 * updates to the teacher's browser until the job reaches a terminal state
 * (COMPLETED, FAILED, or DEAD) or the connection times out after 60 s.
 *
 * SSE event format:
 *   data: {"type":"status","status":"PROCESSING","attempts":1,"lastError":null,"result":null}
 *
 * Terminal event (connection closed after sending):
 *   data: {"type":"status","status":"COMPLETED","result":{...}}
 *
 * Timeout event:
 *   data: {"type":"timeout","message":"..."}
 *
 * Protected by authenticate + requireRole('TEACHER').
 * The requesting teacher must own the job.
 *
 * Notes for production:
 *   - Set `X-Accel-Buffering: no` so Nginx doesn't buffer the stream.
 *   - The client should handle reconnection if the TCP connection drops.
 */
export const streamJobStatus = async (req: AuthRequest, res: Response) => {
  const { jobId } = req.params;

  // ── Pre-flight: verify job & ownership before opening the stream ──────────
  // (Returning JSON errors here is fine because headers haven't been sent yet.)
  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ message: 'jobId is required.' });
  }

  let initialJob: Awaited<ReturnType<typeof db.attendanceJob.findUnique>>;
  try {
    initialJob = await db.attendanceJob.findUnique({ where: { id: jobId } });
  } catch {
    return res.status(500).json({ message: 'Failed to fetch job.' });
  }

  if (!initialJob) {
    return res.status(404).json({ message: 'Job not found.' });
  }
  if (initialJob.teacherId !== req.user!.userId) {
    return res.status(403).json({
      message: 'You do not have permission to stream this job.',
    });
  }

  // ── SSE setup ─────────────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx/proxy buffering
  res.flushHeaders();

  const TERMINAL = new Set(['COMPLETED', 'FAILED', 'DEAD']);
  const POLL_MS = 2_000;  // poll every 2 s
  const MAX_MS = 180_000; // close after 180 s regardless

  let closed = false;

  /** Write a JSON SSE event and flush. */
  const send = (payload: Record<string, unknown>): void => {
    if (closed) return;
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch {
      closed = true;
    }
  };

  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

  const teardown = () => {
    closed = true;
    if (pollTimer) clearInterval(pollTimer);
    if (timeoutTimer) clearTimeout(timeoutTimer);
    pollTimer = null;
    timeoutTimer = null;
  };

  // Clean up when client disconnects (tab close, network drop, etc.)
  req.on('close', () => {
    teardown();
  });

  // ── Send initial status immediately ──────────────────────────────────────
  send({
    type: 'status',
    status: initialJob.status,
    attempts: initialJob.attempts,
    lastError: initialJob.lastError,
    result: initialJob.result,
  });

  // If already terminal, close immediately.
  if (TERMINAL.has(initialJob.status)) {
    teardown();
    res.end();
    return;
  }

  // ── Start polling ─────────────────────────────────────────────────────────
  pollTimer = setInterval(async () => {
    if (closed) return;

    let job: Awaited<ReturnType<typeof db.attendanceJob.findUnique>>;
    try {
      job = await db.attendanceJob.findUnique({ where: { id: jobId } });
    } catch {
      send({ type: 'error', message: 'Failed to fetch job status.' });
      teardown();
      res.end();
      return;
    }

    if (!job) {
      send({ type: 'error', message: 'Job no longer exists.' });
      teardown();
      res.end();
      return;
    }

    send({
      type: 'status',
      status: job.status,
      attempts: job.attempts,
      lastError: job.lastError,
      result: job.result,
    });

    if (TERMINAL.has(job.status)) {
      teardown();
      res.end();
    }
  }, POLL_MS);

  // ── Safety timeout ────────────────────────────────────────────────────────
  timeoutTimer = setTimeout(() => {
    if (closed) return;
    send({
      type: 'timeout',
      message: 'Stream closed after 60 s. Poll GET /api/attendance/job/:jobId for the final status.',
    });
    teardown();
    res.end();
  }, MAX_MS);
};

// ---------------------------------------------------------------------------
// getStudentStats  — UNCHANGED
// ---------------------------------------------------------------------------

export const getStudentStats = async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.user?.userId;

    if (!studentId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const studentProfile = await db.studentProfile.findUnique({
      where: { userId: studentId },
      include: { _count: { select: { classrooms: true } } },
    });

    const totalClasses = studentProfile?._count.classrooms ?? 0;

    const allRecords = await db.attendance.findMany({ where: { studentId } });

    const totalSessions = allRecords.length;
    const presentSessions = allRecords.filter((r) => r.status === 'PRESENT').length;

    const attendancePercentage =
      totalSessions > 0 ? Math.round((presentSessions / totalSessions) * 100) : 0;

    const recentHistory = await db.attendance.findMany({
      where: { studentId },
      orderBy: { date: 'desc' },
      take: 5,
      include: { classroom: { select: { name: true, code: true } } },
    });

    const formattedHistory = recentHistory.map((record) => ({
      id: record.id,
      class: record.classroom.name,
      date: new Date(record.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      status: record.status === 'PRESENT' ? 'Present' : 'Absent',
    }));

    return res.json({ totalClasses, attendancePercentage, history: formattedHistory });

  } catch (error) {
    console.error('[Attendance] getStudentStats error:', error);
    return res.status(500).json({ message: 'Error fetching dashboard stats.' });
  }
};

// ---------------------------------------------------------------------------
// getClassAttendanceHistory  — UNCHANGED
// ---------------------------------------------------------------------------

/**
 * GET /api/attendance/history/:classId?date=YYYY-MM-DD
 */
export const getClassAttendanceHistory = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const { classId } = req.params;
    const { date } = req.query;

    if (!date || typeof date !== 'string') {
      return res.status(400).json({ error: 'date query param is required (YYYY-MM-DD).' });
    }
    if (!classId) {
      return res.status(400).json({ error: 'classId is required.' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    const startOfDay = toUtcMidnight(date);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

    const classroom = await db.classroom.findUnique({
      where: { id: classId },
      include: {
        students: {
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
          },
        },
      },
    });

    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found.' });
    }
    if (classroom.teacherId !== req.user!.userId) {
      return res.status(403).json({ error: 'You do not have permission to view this classroom.' });
    }

    const attendanceRecords = await db.attendance.findMany({
      where: { classId, date: { gte: startOfDay, lte: endOfDay } },
      orderBy: { date: 'desc' },
    });

    const latestByStudent = new Map<string, typeof attendanceRecords[0]>();
    for (const record of attendanceRecords) {
      if (!latestByStudent.has(record.studentId)) {
        latestByStudent.set(record.studentId, record);
      }
    }

    const history = classroom.students.map((profile) => {
      const record = latestByStudent.get(profile.user.id);
      return {
        studentId: profile.user.id,
        name: profile.user.name,
        email: profile.user.email,
        avatar: profile.user.avatar,
        status: record ? record.status : 'ABSENT',
        time: record ? record.date : null,
      };
    });

    const presentCount = history.filter((h) => h.status === 'PRESENT').length;

    return res.json({
      date: startOfDay,
      totalStudents: classroom.students.length,
      presentCount,
      records: history,
    });

  } catch (error) {
    console.error('[Attendance] getClassAttendanceHistory error:', error);
    return res.status(500).json({ error: 'Failed to fetch history.' });
  }
};

// ---------------------------------------------------------------------------
// updateManualAttendance  — UNCHANGED
// ---------------------------------------------------------------------------

/**
 * PATCH /api/attendance/manual
 */
export const updateManualAttendance = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const { classId, date, updates } = req.body as {
      classId?: unknown;
      date?: unknown;
      updates?: unknown;
    };

    if (
      typeof classId !== 'string' ||
      typeof date !== 'string' ||
      !Array.isArray(updates)
    ) {
      return res.status(400).json({ error: 'Invalid request data.' });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    const classroom = await db.classroom.findUnique({ where: { id: classId } });
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found.' });
    }
    if (classroom.teacherId !== req.user!.userId) {
      return res.status(403).json({ error: 'You do not have permission to edit this classroom.' });
    }

    const attendanceDate = toUtcMidnight(date);
    const dayEnd = new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000 - 1);

    const VALID_STATUSES = new Set(['PRESENT', 'ABSENT']);

    await db.$transaction(async (tx) => {
      for (const update of updates as Array<{ studentId: string; status: string }>) {
        if (typeof update.studentId !== 'string' || typeof update.status !== 'string') continue;
        if (!VALID_STATUSES.has(update.status)) continue;

        const existing = await tx.attendance.findFirst({
          where: {
            studentId: update.studentId,
            classId,
            date: { gte: attendanceDate, lte: dayEnd },
          },
        });

        if (existing) {
          await tx.attendance.update({
            where: { id: existing.id },
            data: { status: update.status as 'PRESENT' | 'ABSENT' },
          });
        } else {
          await tx.attendance.create({
            data: {
              studentId: update.studentId,
              classId,
              status: update.status as 'PRESENT' | 'ABSENT',
              date: attendanceDate,
            },
          });
        }
      }
    });

    return res.json({ message: 'Attendance updated successfully.' });

  } catch (error) {
    console.error('[Attendance] updateManualAttendance error:', error);
    return res.status(500).json({ error: 'Failed to update attendance.' });
  }
};