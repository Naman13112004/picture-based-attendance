import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/authMiddleware.js';
import { 
    markAttendance, 
    getStudentStats, 
    getClassAttendanceHistory,
    updateManualAttendance
} from '../controllers/attendanceController.js';

const router = Router();

router.post('/mark', authenticate, requireRole('TEACHER'), markAttendance);

router.get('/stats', authenticate, requireRole('STUDENT'), getStudentStats);

router.get('/history/:classId', getClassAttendanceHistory);

router.patch('/manual', updateManualAttendance);

export default router;