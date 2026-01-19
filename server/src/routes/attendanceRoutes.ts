import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/authMiddleware.js';
import { getStudentStats, markAttendance } from '../controllers/attendanceController.js';

const router = Router();

router.post('/mark', authenticate, requireRole('TEACHER'), markAttendance);

router.get('/stats', authenticate, requireRole('STUDENT'), getStudentStats);

export default router;