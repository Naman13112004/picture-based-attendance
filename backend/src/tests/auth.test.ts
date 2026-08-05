import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import type { Response, Request } from 'express';
import db from '../config/db.js';

const mockBcrypt = {
    hash: jest.fn(),
    compare: jest.fn()
};

const mockJwt = {
    generateToken: jest.fn(),
    verifyToken: jest.fn()
};

jest.unstable_mockModule('bcrypt', () => ({ default: mockBcrypt }));
jest.unstable_mockModule('../utils/jwt.js', () => mockJwt);

const authController = await import('../controllers/authController.js');

describe('Auth Controller Tests', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;

    beforeEach(() => {
        req = { body: {} };
        res = {
            status: jest.fn().mockReturnThis() as any,
            json: jest.fn() as any,
        };
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('register', () => {
        it('should return 400 if email already exists', async () => {
            req.body = { email: 'test@example.com', password: 'password123', name: 'Test', role: 'STUDENT' };
            jest.spyOn(db.user, 'findUnique').mockResolvedValue({ id: '1' } as any);

            await authController.register(req as Request, res as Response);

            expect(db.user.findUnique).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should create user and return 201', async () => {
            req.body = { email: 'new@example.com', password: 'password123', name: 'New', role: 'STUDENT' };
            jest.spyOn(db.user, 'findUnique').mockResolvedValue(null);
            mockBcrypt.hash.mockResolvedValue('hashedpass' as never);
            jest.spyOn(db.user, 'create').mockResolvedValue({ id: '1', email: 'new@example.com', role: 'STUDENT' } as any);
            mockJwt.generateToken.mockReturnValue('token' as never);

            await authController.register(req as Request, res as Response);

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                token: 'token',
                user: expect.any(Object)
            }));
        });
    });

    describe('login', () => {
        it('should return 400 if user not found', async () => {
            req.body = { email: 'notfound@example.com', password: 'password123' };
            jest.spyOn(db.user, 'findUnique').mockResolvedValue(null);

            await authController.login(req as Request, res as Response);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 400 if password mismatch', async () => {
            req.body = { email: 'found@example.com', password: 'wrongpassword' };
            jest.spyOn(db.user, 'findUnique').mockResolvedValue({ id: '1', password: 'hashedpass' } as any);
            mockBcrypt.compare.mockResolvedValue(false as never);

            await authController.login(req as Request, res as Response);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 200 and token on success', async () => {
            req.body = { email: 'found@example.com', password: 'password123' };
            jest.spyOn(db.user, 'findUnique').mockResolvedValue({ id: '1', password: 'hashedpass', role: 'STUDENT' } as any);
            mockBcrypt.compare.mockResolvedValue(true as never);
            mockJwt.generateToken.mockReturnValue('token' as never);

            await authController.login(req as Request, res as Response);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                token: 'token'
            }));
        });
    });
});
