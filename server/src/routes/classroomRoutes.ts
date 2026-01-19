import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/authMiddleware.js';
import { 
    createClassroom, 
    joinClassroom, 
    getClassrooms, 
    updateClassroom, 
    deleteClassroom 
} from '../controllers/classroomController.js';

const router = Router();

// Get all classes (for the logged in user)
router.get('/', authenticate, getClassrooms);

// Create Class (Teacher Only)
router.post('/create', authenticate, requireRole('TEACHER'), createClassroom);

// Join Class (Student Only)
router.post('/join', authenticate, requireRole('STUDENT'), joinClassroom);

router.put('/:id', authenticate, requireRole('TEACHER'), updateClassroom);
router.delete('/:id', authenticate, requireRole('TEACHER'), deleteClassroom);

export default router;