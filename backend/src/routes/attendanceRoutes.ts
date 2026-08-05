import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validationMiddleware.js';
import { attendanceLimiter } from '../middlewares/rateLimitMiddleware.js';
import {
  markAttendance,
  getStudentStats,
  getClassAttendanceHistory,
  updateManualAttendance,
  getJobStatus,
  streamJobStatus,
} from '../controllers/attendanceController.js';
import { markAttendanceSchema, manualAttendanceSchema } from '../schemas/attendanceSchema.js';

const router = Router();

// ---------------------------------------------------------------------------
// Teacher: submit classroom photo — rate-limited + validated
// ---------------------------------------------------------------------------
router.post(
  '/mark',
  authenticate,
  requireRole('TEACHER'),
  attendanceLimiter,
  validate(markAttendanceSchema),
  markAttendance,
);

// ---------------------------------------------------------------------------
// Teacher: async job lifecycle
// ---------------------------------------------------------------------------

/**
 * GET /api/attendance/job/:jobId/stream
 * SSE — must be registered BEFORE /job/:jobId to avoid Express matching
 * the literal string "stream" as a jobId.
 */
router.get('/job/:jobId/stream', authenticate, requireRole('TEACHER'), streamJobStatus);

/** GET /api/attendance/job/:jobId — one-off status poll */
router.get('/job/:jobId', authenticate, requireRole('TEACHER'), getJobStatus);

// ---------------------------------------------------------------------------
// Student: own attendance statistics
// ---------------------------------------------------------------------------
router.get('/stats', authenticate, requireRole('STUDENT'), getStudentStats);

// ---------------------------------------------------------------------------
// Teacher: history + manual corrections
// ---------------------------------------------------------------------------
router.get('/history/:classId', authenticate, requireRole('TEACHER'), getClassAttendanceHistory);
router.patch(
  '/manual',
  authenticate,
  requireRole('TEACHER'),
  validate(manualAttendanceSchema),
  updateManualAttendance,
);

export default router;