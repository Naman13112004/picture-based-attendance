// src/schemas/attendanceSchema.ts
// Zod v4 uses `error` instead of `required_error` / `invalid_type_error`
import { z } from 'zod';

// Reusable YYYY-MM-DD date string validator
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.');

/** POST /api/attendance/mark */
export const markAttendanceSchema = z.object({
  classId: z
    .string()
    .uuid('classId must be a valid UUID.'),

  image: z
    .string()
    .min(1, 'image must not be empty.')
    .refine(
      (v) => v.startsWith('data:image/'),
      'image must be a base64 data-URI (data:image/...).',
    ),

  // Optional — server falls back to today's UTC date if omitted
  date: dateString.optional(),
});

/** PATCH /api/attendance/manual */
export const manualAttendanceSchema = z.object({
  classId: z
    .string()
    .uuid('classId must be a valid UUID.'),

  date: dateString,

  updates: z
    .array(
      z.object({
        studentId: z.string().uuid('studentId must be a valid UUID.'),
        status:    z.enum(['PRESENT', 'ABSENT'] as const),
      }),
    )
    .min(1, 'updates must contain at least one entry.'),
});

export type MarkAttendanceInput   = z.infer<typeof markAttendanceSchema>;
export type ManualAttendanceInput = z.infer<typeof manualAttendanceSchema>;
