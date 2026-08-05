import { Router } from 'express';
import { register, login, googleLogin } from '../controllers/authController.js';
import { validate } from '../middlewares/validationMiddleware.js';
import { authLimiter, loginSlowDown } from '../middlewares/rateLimitMiddleware.js';
import { registerSchema, loginSchema, googleLoginSchema } from '../schemas/authSchema.js';

const router = Router();

// Rate-limited + validated auth endpoints
router.post('/register', validate(registerSchema), register);
router.post('/login', authLimiter, loginSlowDown, validate(loginSchema), login);
router.post('/google', authLimiter, validate(googleLoginSchema), googleLogin);

export default router;