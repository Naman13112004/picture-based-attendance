import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { authenticate, requireRole } from '../middlewares/authMiddleware.js';
import type { AuthRequest } from '../middlewares/authMiddleware.js';
import type { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

describe('Middleware Tests', () => {
    describe('authMiddleware', () => {
        let req: Partial<AuthRequest>;
        let res: Partial<Response>;
        let next: NextFunction;

        beforeEach(() => {
            req = {
                headers: {},
                query: {}
            };
            res = {
                status: jest.fn().mockReturnThis() as any,
                json: jest.fn() as any
            };
            next = jest.fn();
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should return 401 if no token provided', () => {
            authenticate(req as AuthRequest, res as Response, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized: No token provided.' });
        });

        it('should return 401 if token is expired', () => {
            req.headers = { authorization: 'Bearer expired.token.here' };
            jest.spyOn(jwt, 'verify').mockImplementation(() => {
                throw new jwt.TokenExpiredError('jwt expired', new Date());
            });

            authenticate(req as AuthRequest, res as Response, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TOKEN_EXPIRED' }));
        });

        it('should allow valid token and call next()', () => {
            req.headers = { authorization: 'Bearer valid.token' };
            jest.spyOn(jwt, 'verify').mockReturnValue({ userId: '123', role: 'STUDENT' } as any);

            authenticate(req as AuthRequest, res as Response, next);
            expect(req.user).toBeDefined();
            expect(req.user?.userId).toBe('123');
            expect(next).toHaveBeenCalled();
        });
    });

    describe('requireRole', () => {
        let req: Partial<AuthRequest>;
        let res: Partial<Response>;
        let next: NextFunction;

        beforeEach(() => {
            req = { user: { userId: '123', role: 'STUDENT' } };
            res = {
                status: jest.fn().mockReturnThis() as any,
                json: jest.fn() as any
            };
            next = jest.fn();
        });

        it('should return 403 if role does not match', () => {
            const middleware = requireRole('TEACHER');
            middleware(req as AuthRequest, res as Response, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INSUFFICIENT_ROLE' }));
        });

        it('should call next if role matches', () => {
            const middleware = requireRole('STUDENT');
            middleware(req as AuthRequest, res as Response, next);
            expect(next).toHaveBeenCalled();
        });
    });
});
