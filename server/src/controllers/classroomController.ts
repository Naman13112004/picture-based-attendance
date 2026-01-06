import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/authMiddleware.js';
import db from '../config/db.js';
import { nanoid } from 'nanoid'; // You might need: npm install nanoid

export const createClassroom = async (req: AuthRequest, res: Response) => {
  try {
    const { name, schedule } = req.body;

    // Safety check: Ensure user is a Teacher
    if (req.user?.role !== 'TEACHER') {
      return res.status(403).json({ message: "Only teachers can create classrooms" });
    }

    const code = nanoid(6).toUpperCase();

    const classroom = await db.classroom.create({
      data: {
        name,
        schedule,
        code,
        teacherId: req.user.userId,
      },
    });

    res.status(201).json(classroom);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating classroom' });
  }
};

export const joinClassroom = async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body;

    if (req.user?.role !== 'STUDENT') {
      return res.status(403).json({ message: "Only students can join classrooms" });
    }

    if (!req.user?.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const studentId = req.user.userId;

    // Find the classroom
    const classroom = await db.classroom.findUnique({ where: { code } });
    if (!classroom) return res.status(404).json({ message: 'Invalid Class Code' });

    // Find Student Profile
    const studentProfile = await db.studentProfile.findUnique({ where: { userId: studentId } });
    if (!studentProfile) return res.status(400).json({ message: 'Profile not found' });

    // Connect Student to Class (Many-to-Many via Prisma implicit relation logic)
    await db.studentProfile.update({
      where: { id: studentProfile.id },
      data: {
        classrooms: {
          connect: { id: classroom.id }
        }
      }
    });

    res.json({ message: `Successfully joined ${classroom.name}` });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error joining classroom' });
  }
};

export const getClassrooms = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role } = req.user!;

    if (role === 'TEACHER') {
      const classes = await db.classroom.findMany({
        where: { teacherId: userId },
        include: { _count: { select: { students: true } } }
      });
      return res.json(classes);
    } else {
      // Get classes where student is enrolled
      const profile = await db.studentProfile.findUnique({
        where: { userId },
        include: { classrooms: true }
      });
      return res.json(profile?.classrooms || []);
    }
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
}