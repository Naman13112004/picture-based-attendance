import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import type { Job } from 'bullmq';
import db from '../config/db.js';

class MockAxiosError extends Error {
    isAxiosError = true;
    response: any;
    request: any;
}
const mockAxios = {
    get: jest.fn(),
    post: jest.fn(),
    isAxiosError: jest.fn().mockReturnValue(false)
};
jest.unstable_mockModule('axios', () => ({ 
    default: mockAxios,
    AxiosError: MockAxiosError
}));

const workerProcessor = await import('../worker/attendanceProcessor.js');

jest.setTimeout(30000);

describe('Worker Tests', () => {
    let job: Partial<Job>;

    const teacherId = 'teacher-1';
    const classId = 'class-1';
    const jobId = 'job-1';

    beforeEach(() => {
        job = {
            id: 'redis-job-1',
            attemptsMade: 0,
            opts: { attempts: 3 },
            data: { jobDbId: jobId, classId, teacherId, date: '2026-08-01' },
            updateProgress: jest.fn().mockResolvedValue(undefined as never),
        } as unknown as Job;
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('processAttendanceJob', () => {
        it('should mark job as FAILED if dbJob not found', async () => {
            job.data.jobDbId = 'invalid-id';
            jest.spyOn(db.attendanceJob, 'findUnique').mockResolvedValue(null);
            jest.spyOn(db.attendanceJob, 'update').mockResolvedValue({} as any);
            
            await expect(workerProcessor.processAttendanceJob(job as Job)).rejects.toThrow();
        });

        it('should process job and update attendance correctly', async () => {
            jest.spyOn(db.attendanceJob, 'update').mockResolvedValue({} as any);
            jest.spyOn(db.classroom, 'findUnique').mockResolvedValue({
                id: classId,
                teacherId,
                students: [{ userId: 'student-1' }]
            } as any);

            // Mock idempotency check
            jest.spyOn(db.attendance, 'count').mockResolvedValue(0);

            jest.spyOn(db.attendanceJob, 'findUnique').mockResolvedValue({
                id: jobId,
                imageUrl: 'http://test-url.com/image.jpg'
            } as any);

            mockAxios.post.mockResolvedValue({
                data: {
                    face_count: 1,
                    embeddings: [Array(128).fill(0.1)]
                }
            } as never);

            mockAxios.get.mockResolvedValue({
                data: Buffer.from("fake-image"),
                headers: {
                    "content-type": "image/jpeg",
                },
            } as never);

            jest.spyOn(db, '$queryRawUnsafe').mockResolvedValue([{ userId: 'student-1', distance: 0.1 }] as any);
            jest.spyOn(db.attendance, 'createMany').mockResolvedValue({} as any);
            jest.spyOn(db, '$transaction').mockImplementation(async (cb: any) => {
                if (typeof cb === 'function') return cb(db);
                return [];
            });

            await workerProcessor.processAttendanceJob(job as Job);

            expect(mockAxios.post).toHaveBeenCalled();
            expect(db.attendanceJob.update).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ status: 'COMPLETED' })
            }));
            expect(db.$queryRawUnsafe).toHaveBeenCalled();
            expect(db.attendance.createMany).toHaveBeenCalled();
        });
    });
});
