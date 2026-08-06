import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/authMiddleware.js';
import db from '../config/db.js';
import { randomUUID } from 'crypto';

const mockEnqueueAttendanceJob = jest.fn();
jest.unstable_mockModule('../queues/attendanceQueue.js', () => ({
    enqueueAttendanceJob: mockEnqueueAttendanceJob,
}));

const mockFileHelper = {
    saveClassroomImage: jest.fn()
};
jest.unstable_mockModule('../utils/fileHelper.js', () => mockFileHelper);

const attendanceController = await import('../controllers/attendanceController.js');

describe('Attendance Controller Tests', () => {
    let req: Partial<AuthRequest>;
    let res: Partial<Response>;

    const teacherId = randomUUID();
    const otherTeacherId = randomUUID();
    const classId = 'class-1';

    beforeEach(() => {
        req = {
            body: {},
            user: { userId: teacherId, role: 'TEACHER' }
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

    describe('markAttendance', () => {
        it('should return 403 if teacher does not own the classroom', async () => {
            req.user = { userId: otherTeacherId, role: 'TEACHER' };
            req.body = { classId, image: 'data:image/jpeg;base64,mock', date: '2026-08-01' };

            jest.spyOn(db.classroom, 'findUnique').mockResolvedValue({ id: classId, teacherId } as any);

            await attendanceController.markAttendance(req as AuthRequest, res as Response);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'You do not have permission to mark attendance for this classroom.'
            }));
        });

        it('should return 409 if a job already exists for this date', async () => {
            req.body = { classId, image: 'data:image/jpeg;base64,mock', date: '2026-08-01' };

            jest.spyOn(db.classroom, 'findUnique').mockResolvedValue({ id: classId, teacherId } as any);
            jest.spyOn(db.attendanceJob, 'findFirst').mockResolvedValue({ id: 'job-1', status: 'QUEUED' } as any);

            await attendanceController.markAttendance(req as AuthRequest, res as Response);

            expect(res.status).toHaveBeenCalledWith(409);
        });

        it('should enqueue job and return 202', async () => {
            req.body = { classId, image: 'data:image/jpeg;base64,mock', date: '2026-08-01' };

            jest.spyOn(db.classroom, 'findUnique').mockResolvedValue({ id: classId, teacherId } as any);
            jest.spyOn(db.attendanceJob, 'findFirst').mockResolvedValue(null);
            
            mockFileHelper.saveClassroomImage.mockResolvedValue('http://mock-url' as never);
            jest.spyOn(db.attendanceJob, 'create').mockResolvedValue({ id: 'job-db-1' } as any);
            mockEnqueueAttendanceJob.mockResolvedValue({ id: 'redis-job-1' } as never);

            await attendanceController.markAttendance(req as AuthRequest, res as Response);

            expect(mockEnqueueAttendanceJob).toHaveBeenCalledTimes(1);
            expect(res.status).toHaveBeenCalledWith(202);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Attendance processing has started. Track progress via the job stream.'
            }));
        });
    });
});
