import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validationMiddleware.js';
import {
  createClassroom,
  joinClassroom,
  getClassrooms,
  updateClassroom,
  deleteClassroom,
} from '../controllers/classroomController.js';
import {
  createClassroomSchema,
  joinClassroomSchema,
  updateClassroomSchema,
} from '../schemas/classroomSchema.js';

const router = Router();

// Get all classrooms for the logged-in user
router.get('/', authenticate, getClassrooms);

// Teacher: create classroom
router.post('/create', authenticate, requireRole('TEACHER'), validate(createClassroomSchema), createClassroom);

// Student: join classroom
router.post('/join', authenticate, requireRole('STUDENT'), validate(joinClassroomSchema), joinClassroom);

// Teacher: update / delete classroom
router.put('/:id',    authenticate, requireRole('TEACHER'), validate(updateClassroomSchema), updateClassroom);
router.delete('/:id', authenticate, requireRole('TEACHER'), deleteClassroom);

export default router;