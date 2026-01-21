import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/authMiddleware.js';
import { 
    markAttendance, 
    getStudentStats, 
    getClassAttendanceHistory
} from '../controllers/attendanceController.js';

const router = Router();

router.post('/mark', authenticate, requireRole('TEACHER'), markAttendance);

router.get('/stats', authenticate, requireRole('STUDENT'), getStudentStats);

router.get('/history/:classId', getClassAttendanceHistory);

export default router;