// src/schemas/authSchema.ts
// Zod v4 uses `error` instead of `required_error` / `invalid_type_error`
import { z } from 'zod';

/** POST /api/auth/register */
export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2,   'Name must be at least 2 characters.')
    .max(100, 'Name must be at most 100 characters.'),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email address.'),

  password: z
    .string()
    .min(8,   'Password must be at least 8 characters.')
    .max(128, 'Password must be at most 128 characters.'),

  role: z.enum(['TEACHER', 'STUDENT'] as const),
});

/** POST /api/auth/login */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email address.'),

  password: z
    .string()
    .min(1, 'Password is required.'),
});

/** POST /api/auth/google */
export const googleLoginSchema = z.object({
  token: z
    .string()
    .min(1, 'Google ID token must not be empty.'),
});

export type RegisterInput    = z.infer<typeof registerSchema>;
export type LoginInput       = z.infer<typeof loginSchema>;
export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;
