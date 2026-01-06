import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/authMiddleware.js';
import { updateStudentImages, getProfile } from '../controllers/profileController.js';

const router = Router();

router.get('/', authenticate, getProfile);
router.post('/upload-faces', authenticate, requireRole('STUDENT'), updateStudentImages);

export default router;