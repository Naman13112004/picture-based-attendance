import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request interface to include user
export interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

interface JwtUserPayload {
  userId: string;
  role: string;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  if(!token) {
    res.status(500).json({ message: "Auth token is required" });
  }

  try {
    const decoded = jwt.verify(token!, process.env.JWT_SECRET || "");

    if(typeof decoded !== "object" || decoded === null) {
        throw new Error("Invalid token");
    }

    req.user = decoded as JwtUserPayload;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Forbidden: Invalid token' });
  }
};

// Role Guard (Optional helper)
export const requireRole = (role: 'TEACHER' | 'STUDENT') => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (req.user?.role !== role) {
            return res.status(403).json({ message: "Access denied: Insufficient permissions"});
        }
        next();
    }
}