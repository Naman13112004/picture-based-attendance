// src/middlewares/correlationMiddleware.ts
// Attaches a unique request correlation ID to every incoming request.
//
// Priority (highest first):
//   1. Forward the X-Correlation-Id header sent by an upstream proxy.
//   2. Forward the X-Request-Id header (common Nginx/Heroku convention).
//   3. Generate a new UUID via crypto.randomUUID().
//
// The ID is:
//   - Attached to `req.correlationId` for use in controller logs.
//   - Added to every response as the `X-Correlation-Id` header so that
//     the client can correlate its own request with server-side log lines.

import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Augment Express Request to expose the correlation ID
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

/**
 * Express middleware that guarantees every request has a unique correlation ID.
 * Register this as the FIRST middleware in app.use() chains so that all
 * subsequent middleware and controllers can reference `req.correlationId`.
 */
export function correlationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming =
    (req.headers['x-correlation-id'] as string | undefined) ||
    (req.headers['x-request-id']    as string | undefined);

  // Only accept an incoming ID if it looks like a safe, bounded string.
  // Reject anything longer than 128 chars to prevent log-injection.
  const correlationId =
    incoming && incoming.length <= 128 ? incoming : randomUUID();

  req.correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);

  next();
}
