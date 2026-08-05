// src/middlewares/authMiddleware.ts
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const { TokenExpiredError, JsonWebTokenError } = jwt;

// Extend Express Request interface to include user
export interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

interface JwtUserPayload {
  userId: string;
  role: string;
}

/**
 * authenticate — verifies the JWT in the Authorization header.
 *
 * Error distinctions (Phase 4):
 *   - Missing/malformed header → 401
 *   - Expired token            → 401 (client should refresh / re-login)
 *   - Tampered / invalid token → 403 (potential attack; don't give hints)
 */
export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1] || '';
  } else if (req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    res.status(401).json({ message: 'Unauthorized: No token provided.' });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Server misconfiguration — don't leak details
    console.error('[Auth] JWT_SECRET is not set.');
    res.status(500).json({ message: 'Server configuration error.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret);

    if (typeof decoded !== 'object' || decoded === null) {
      throw new JsonWebTokenError('Invalid payload type.');
    }

    req.user = decoded as JwtUserPayload;
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      // Token was valid but has expired — tell the client to re-login
      res.status(401).json({
        message: 'Session expired. Please log in again.',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }

    // JsonWebTokenError (tampered signature, wrong algorithm, etc.)
    // Return 403 — the request is understood but deliberately refused
    res.status(403).json({
      message: 'Forbidden: Invalid token.',
      code: 'TOKEN_INVALID',
    });
  }
};

/**
 * requireRole — role-based access guard.
 * Must be used AFTER `authenticate` so that `req.user` is populated.
 */
export const requireRole = (role: 'TEACHER' | 'STUDENT') => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (req.user?.role !== role) {
      res.status(403).json({
        message: `Access denied: ${role} role required.`,
        code: 'INSUFFICIENT_ROLE',
      });
      return;
    }
    next();
  };
};