import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { updateStudentImages } from '../controllers/profileController.js';
import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/authMiddleware.js';
import db from '../config/db.js';
import axios from 'axios';

describe('Profile Controller Tests', () => {
    let req: Partial<AuthRequest>;
    let res: Partial<Response>;

    const studentId = 'student_test_id_1';

    beforeEach(() => {
        req = {
            body: {},
            user: { userId: studentId, role: 'STUDENT' }
        };
        res = {
            status: jest.fn().mockReturnThis() as any,
            json: jest.fn() as any,
        };
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('updateStudentImages', () => {
        it('should return 400 if less than 3 images are provided', async () => {
            req.body = { images: ['img1', 'img2'] };
            await updateStudentImages(req as AuthRequest, res as Response);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Please provide exactly 3 images as a JSON array.'
            }));
        });

        it('should update profile and compute face vector successfully', async () => {
            const img = "data:image/jpeg;base64,ZmFrZQ==";
            req.body = { images: [img, img, img] };

            // Mock AI service
            const mockEmbedding = Array(128).fill(0.1);
            jest.spyOn(axios, 'post').mockResolvedValue({
                data: { embedding: mockEmbedding }
            });

            // Mock Prisma
            jest.spyOn(db.studentProfile, 'findUnique').mockResolvedValue({ id: 'prof-1' } as any);
            jest.spyOn(db.studentProfile, 'update').mockResolvedValue({} as any);
            jest.spyOn(db, '$executeRawUnsafe').mockResolvedValue(1);

            await updateStudentImages(req as AuthRequest, res as Response);

            expect(axios.post).toHaveBeenCalledTimes(3);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Face data updated successfully.'
            }));
            
            expect(db.studentProfile.update).toHaveBeenCalled();
            expect(db.$executeRawUnsafe).toHaveBeenCalled();
        });
    });
});
