import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validationMiddleware.js';
import { profileUploadLimiter } from '../middlewares/rateLimitMiddleware.js';
import { updateStudentImages, getProfile } from '../controllers/profileController.js';
import { uploadFacesSchema } from '../schemas/profileSchema.js';

const router = Router();

// Any authenticated user can fetch their own profile
router.get('/', authenticate, getProfile);

// Student face image upload — rate-limited + validated
router.post(
  '/upload-faces',
  authenticate,
  requireRole('STUDENT'),
  profileUploadLimiter,
  validate(uploadFacesSchema),
  updateStudentImages,
);

export default router;