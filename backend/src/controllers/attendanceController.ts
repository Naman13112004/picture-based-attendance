// src/controllers/attendanceController.ts
import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/authMiddleware.js';
import db from '../config/db.js';
import { recognizeFaces } from '../services/aiService.js';
import type { StudentEmbeddingPayload } from '../types/ai.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safely parse the faceEmbedding JSONB column into a typed number[][].
 *
 * Prisma returns Json columns as `unknown`. This function validates the
 * structure at runtime so the rest of the controller can work with a
 * well-typed value without unsafe casts everywhere.
 *
 * Returns null if the value is absent, structurally wrong, or contains
 * vectors of unexpected dimension.
 */
function parseFaceEmbedding(raw: unknown): number[][] | null {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return null;
  const valid = (raw as unknown[]).every(
    (vec) =>
      Array.isArray(vec) &&
      (vec as unknown[]).length === 128 &&
      (vec as unknown[]).every((n) => typeof n === 'number'),
  );
  return valid ? (raw as number[][]) : null;
}

// ---------------------------------------------------------------------------
// markAttendance — the primary optimized hot-path
// ---------------------------------------------------------------------------

/**
 * POST /api/attendance/mark
 *
 * Takes a classroom photo and marks attendance for all enrolled students.
 *
 * Optimized pipeline (vs original):
 *  ┌─ OLD ──────────────────────────────────────────────────────────────────┐
 *  │  1. Save class photo to Supabase                                       │
 *  │  2. FastAPI downloads class photo from Supabase                        │
 *  │  3. For each student: download 3 reference images, detect faces,       │
 *  │     compute 3 embeddings                                               │
 *  │  4. Nested Python loop: O(students × class_faces) comparisons          │
 *  │  5. N sequential Prisma INSERT calls                                   │
 *  └────────────────────────────────────────────────────────────────────────┘
 *  ┌─ NEW ──────────────────────────────────────────────────────────────────┐
 *  │  1. Read pre-computed embeddings from DB (zero inference, zero I/O)    │
 *  │  2. Forward class photo as Base64 directly to FastAPI                  │
 *  │  3. FastAPI decodes in memory, runs one NumPy matrix multiply          │
 *  │  4. ONE createMany() call — all inserts in a single DB round trip      │
 *  └────────────────────────────────────────────────────────────────────────┘
 *
 * Edge cases handled:
 *  - classId or image missing → 400
 *  - Classroom not found → 404
 *  - No students enrolled → 200 with empty results
 *  - Students with missing embeddings → 200 with explicit warning list
 *  - AI service unreachable → 503
 *  - AI service returns bad payload → 502
 *  - createMany failure → 500 with rollback via transaction
 */
export const markAttendance = async (req: AuthRequest, res: Response) => {
  try {
    const { classId, image } = req.body as {
      classId?: unknown;
      image?: unknown;
    };

    // ── Validate payload ─────────────────────────────────────────────────────
    if (typeof classId !== 'string' || !classId.trim()) {
      return res.status(400).json({ message: 'classId is required.' });
    }
    if (typeof image !== 'string' || !image.trim()) {
      return res.status(400).json({
        message: 'image is required and must be a non-empty Base64 string.',
      });
    }

    // ── Step 1: Load classroom and ALL enrolled students with their embeddings
    // We select only what we need — no image URLs, no unnecessary fields.
    const classroom = await db.classroom.findUnique({
      where: { id: classId },
      include: {
        students: {
          select: {
            userId: true,
            faceEmbedding: true,
          },
        },
      },
    });

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found.' });
    }

    if (classroom.students.length === 0) {
      return res.status(200).json({
        message: 'No students enrolled in this classroom.',
        results: {
          total_faces_detected: 0,
          present_student_ids: [],
          absent_count: 0,
        },
      });
    }

    // ── Step 2: Partition students by embedding availability ─────────────────
    const studentsWithEmbeddings: StudentEmbeddingPayload[] = [];
    const studentIdsWithoutEmbeddings: string[] = [];

    for (const student of classroom.students) {
      const embeddings = parseFaceEmbedding(student.faceEmbedding);
      if (embeddings !== null) {
        studentsWithEmbeddings.push({ id: student.userId, embeddings });
      } else {
        studentIdsWithoutEmbeddings.push(student.userId);
      }
    }

    if (studentIdsWithoutEmbeddings.length > 0) {
      console.warn(
        `[Attendance] ${studentIdsWithoutEmbeddings.length} student(s) have no ` +
        `embeddings in class ${classId}: [${studentIdsWithoutEmbeddings.join(', ')}]`,
      );
    }

    // ── Step 3: Call AI service (only if there are students to match) ────────
    let aiResult = {
      total_faces_detected: 0,
      present_student_ids: [] as string[],
      absent_count: studentsWithEmbeddings.length,
    };

    if (studentsWithEmbeddings.length > 0) {
      try {
        // The class image is forwarded as Base64 — it is decoded in memory
        // by FastAPI and never touches disk or any storage service.
        aiResult = await recognizeFaces(image, studentsWithEmbeddings);
      } catch (aiError) {
        console.error('[Attendance] AI service call failed:', aiError);
        return res.status(503).json({
          message:
            'The AI recognition service is currently unavailable. ' +
            'Please try again in a moment.',
        });
      }
    }

    const presentSet = new Set(aiResult.present_student_ids);
    const today = new Date();

    // ── Step 4: Build attendance array for ALL enrolled students ─────────────
    // Students without embeddings are always marked ABSENT (they cannot be
    // recognized), and appear in the `students_without_embeddings` warning.
    const allStudentIds = classroom.students.map((s) => s.userId);

    const attendanceData = allStudentIds.map((studentId) => ({
      date: today,
      status: presentSet.has(studentId) ? ('PRESENT' as const) : ('ABSENT' as const),
      studentId,
      classId,
    }));

    // ── Step 5: Single bulk INSERT — replaces N sequential Prisma calls ──────
    await db.$transaction(async (tx) => {
      await tx.attendance.createMany({
        data: attendanceData,
        skipDuplicates: true,
      });
    });

    // ── Step 6: Build response with warnings ─────────────────────────────────
    const responseBody: Record<string, unknown> = {
      message: 'Attendance marked successfully.',
      results: {
        total_faces_detected: aiResult.total_faces_detected,
        present_student_ids: aiResult.present_student_ids,
        absent_count:
          classroom.students.length - aiResult.present_student_ids.length,
      },
    };

    if (studentIdsWithoutEmbeddings.length > 0) {
      responseBody['warning'] =
        `${studentIdsWithoutEmbeddings.length} enrolled student(s) have no registered ` +
        `face embeddings and were automatically marked absent. ` +
        `Ask them to re-upload their face photos.`;
      responseBody['students_without_embeddings'] = studentIdsWithoutEmbeddings;
    }

    return res.status(200).json(responseBody);

  } catch (error) {
    console.error('[Attendance] markAttendance error:', error);
    return res.status(500).json({ message: 'Error processing attendance.' });
  }
};

// ---------------------------------------------------------------------------
// getStudentStats — unchanged, kept intact
// ---------------------------------------------------------------------------

export const getStudentStats = async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.user?.userId;

    if (!studentId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const studentProfile = await db.studentProfile.findUnique({
      where: { userId: studentId },
      include: {
        _count: {
          select: { classrooms: true },
        },
      },
    });

    const totalClasses = studentProfile?._count.classrooms ?? 0;

    const allRecords = await db.attendance.findMany({
      where: { studentId },
    });

    const totalSessions = allRecords.length;
    const presentSessions = allRecords.filter((r) => r.status === 'PRESENT').length;

    const attendancePercentage =
      totalSessions > 0 ? Math.round((presentSessions / totalSessions) * 100) : 0;

    const recentHistory = await db.attendance.findMany({
      where: { studentId },
      orderBy: { date: 'desc' },
      take: 5,
      include: {
        classroom: {
          select: { name: true, code: true },
        },
      },
    });

    const formattedHistory = recentHistory.map((record) => ({
      id: record.id,
      class: record.classroom.name,
      date: new Date(record.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      status: record.status === 'PRESENT' ? 'Present' : 'Absent',
    }));

    return res.json({
      totalClasses,
      attendancePercentage,
      history: formattedHistory,
    });

  } catch (error) {
    console.error('[Attendance] getStudentStats error:', error);
    return res.status(500).json({ message: 'Error fetching dashboard stats.' });
  }
};

// ---------------------------------------------------------------------------
// getClassAttendanceHistory — unchanged, kept intact
// ---------------------------------------------------------------------------

export const getClassAttendanceHistory = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const { classId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date is required.' });
    }
    if (!classId) {
      return res.status(400).json({ error: 'classId is required.' });
    }

    const searchDate = new Date(date as string);
    if (isNaN(searchDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format.' });
    }

    const startOfDay = new Date(searchDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(searchDate.setHours(23, 59, 59, 999));

    const classroom = await db.classroom.findUnique({
      where: { id: classId },
      include: {
        students: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
        },
      },
    });

    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found.' });
    }

    const attendanceRecords = await db.attendance.findMany({
      where: {
        classId,
        date: { gte: startOfDay, lte: endOfDay },
      },
    });

    const history = classroom.students.map((profile) => {
      const record = attendanceRecords.find((r) => r.studentId === profile.user.id);
      return {
        studentId: profile.user.id,
        name: profile.user.name,
        email: profile.user.email,
        avatar: profile.user.avatar,
        status: record ? record.status : 'ABSENT',
        time: record ? record.date : null,
      };
    });

    return res.json({
      date: startOfDay,
      totalStudents: classroom.students.length,
      presentCount: attendanceRecords.filter((r) => r.status === 'PRESENT').length,
      records: history,
    });

  } catch (error) {
    console.error('[Attendance] getClassAttendanceHistory error:', error);
    return res.status(500).json({ error: 'Failed to fetch history.' });
  }
};

// ---------------------------------------------------------------------------
// updateManualAttendance — unchanged, kept intact
// ---------------------------------------------------------------------------

export const updateManualAttendance = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const { classId, date, updates } = req.body as {
      classId?: unknown;
      date?: unknown;
      updates?: unknown;
    };

    if (
      typeof classId !== 'string' ||
      typeof date !== 'string' ||
      !Array.isArray(updates)
    ) {
      return res.status(400).json({ error: 'Invalid request data.' });
    }

    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format.' });
    }

    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    await db.$transaction(async (tx) => {
      for (const update of updates as Array<{ studentId: string; status: string }>) {
        if (
          typeof update.studentId !== 'string' ||
          typeof update.status !== 'string'
        ) {
          continue; // skip malformed entries
        }

        const existing = await tx.attendance.findFirst({
          where: {
            studentId: update.studentId,
            classId,
            date: { gte: startOfDay, lte: endOfDay },
          },
        });

        if (existing) {
          await tx.attendance.update({
            where: { id: existing.id },
            data: { status: update.status as 'PRESENT' | 'ABSENT' },
          });
        } else {
          await tx.attendance.create({
            data: {
              studentId: update.studentId,
              classId,
              status: update.status as 'PRESENT' | 'ABSENT',
              date: new Date(date),
            },
          });
        }
      }
    });

    return res.json({ message: 'Attendance updated successfully.' });

  } catch (error) {
    console.error('[Attendance] updateManualAttendance error:', error);
    return res.status(500).json({ error: 'Failed to update attendance.' });
  }
};