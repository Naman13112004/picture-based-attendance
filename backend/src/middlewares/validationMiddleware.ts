// src/middlewares/validationMiddleware.ts
// Factory function that returns an Express middleware which validates
// req.body against a Zod schema and returns structured 400 errors on failure.

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

/**
 * Creates an Express middleware that validates `req.body` against the given
 * Zod schema. On success, `req.body` is replaced with the parsed (and
 * coerced/stripped) result so downstream handlers receive clean data.
 * On failure, responds with HTTP 400 and a structured error list.
 *
 * Usage:
 *   router.post('/login', validate(loginSchema), loginHandler);
 *
 * Error response shape:
 *   {
 *     "message": "Validation failed.",
 *     "errors": [
 *       { "field": "email",    "message": "Invalid email" },
 *       { "field": "password", "message": "String must contain at least 8 character(s)" }
 *     ]
 *   }
 *
 * @param schema  Any Zod schema (typically z.object({...})).
 */
export function validate<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      // Zod v4: issues replaces errors
      const issues = result.error.issues ?? [];
      const errors = issues.map((issue) => ({
        field:   issue.path.join('.') || 'body',
        message: issue.message,
      }));

      res.status(400).json({
        message: 'Validation failed.',
        errors,
      });
      return;
    }

    // Replace req.body with the Zod-parsed output so controllers
    // receive coerced, trimmed, and stripped data.
    req.body = result.data as z.infer<T>;
    next();
  };
}
