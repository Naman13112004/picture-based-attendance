import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/authMiddleware.js';
import { markAttendance } from '../controllers/attendanceController.js';

const router = Router();

router.post('/mark', authenticate, requireRole('TEACHER'), markAttendance);

export default router;