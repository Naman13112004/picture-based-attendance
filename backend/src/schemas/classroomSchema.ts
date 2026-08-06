// src/schemas/classroomSchema.ts
// Zod v4 uses `error` instead of `required_error` / `invalid_type_error`
import { z } from 'zod';

/** POST /api/classrooms/create */
export const createClassroomSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1,   'Classroom name must not be empty.')
    .max(150, 'Classroom name must be at most 150 characters.'),

  schedule: z
    .string()
    .trim()
    .max(200, 'Schedule description must be at most 200 characters.')
    .optional(),
});

/** POST /api/classrooms/join */
export const joinClassroomSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1,  'Classroom code must not be empty.')
    .max(20, 'Classroom code is too long.'),
});

/** PUT /api/classrooms/:id */
export const updateClassroomSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1,   'Classroom name must not be empty.')
      .max(150, 'Classroom name must be at most 150 characters.')
      .optional(),

    schedule: z
      .string()
      .trim()
      .max(200, 'Schedule description must be at most 200 characters.')
      .optional(),
  })
  .refine(
    (data) => data.name !== undefined || data.schedule !== undefined,
    { message: 'At least one field (name or schedule) must be provided.' },
  );

export type CreateClassroomInput = z.infer<typeof createClassroomSchema>;
export type JoinClassroomInput   = z.infer<typeof joinClassroomSchema>;
export type UpdateClassroomInput = z.infer<typeof updateClassroomSchema>;
