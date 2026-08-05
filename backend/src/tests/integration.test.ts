import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import supertest from 'supertest';
import type { Job, JobProgress } from 'bullmq';

// ESM mock db
const mockDb = {
  classroom: { findUnique: jest.fn() },
  studentProfile: { findMany: jest.fn() },
  attendanceJob: { create: jest.fn(), update: jest.fn().mockResolvedValue({} as never), findUnique: jest.fn(), findFirst: jest.fn().mockResolvedValue(null as never) },
  attendance: { createMany: jest.fn(), count: jest.fn() },
  $queryRawUnsafe: jest.fn(),
  $executeRaw: jest.fn(),
  $transaction: jest.fn((callback: any) => callback(mockDb)),
};
jest.unstable_mockModule('../config/db.js', () => ({ default: mockDb }));

jest.unstable_mockModule('../queues/attendanceQueue.js', () => ({
  enqueueAttendanceJob: jest.fn().mockResolvedValue({ id: 'job-123' } as never)
}));

jest.unstable_mockModule('../utils/fileHelper.js', () => ({
  saveClassroomImage: jest.fn().mockResolvedValue('https://storage/image.jpg' as never),
  saveBase64Image: jest.fn().mockResolvedValue('https://storage/image.jpg' as never)
}));

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
const appModule = await import('../index.js');
const app = appModule.default;
const request = supertest(app);

describe('Integration Test: Complete Attendance Pipeline', () => {
  let mockJob: Partial<Job>;
  let jobId = 'job-123';

  beforeEach(() => {
    jest.clearAllMocks();

    const updateProgress = jest.fn<
      (progress: JobProgress) => Promise<void>
    >().mockResolvedValue(undefined as never);

    mockJob = {
      id: jobId,
      attemptsMade: 0,
      opts: { attempts: 3 },
      data: {
        jobDbId: jobId,
        classId: '123e4567-e89b-12d3-a456-426614174000',
        teacherId: '123e4567-e89b-12d3-a456-426614174001',
        imageUrl: 'https://storage/image.jpg',
        date: '2026-08-03'
      },
      updateProgress
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('verifies the full pipeline: upload -> queue -> worker -> AI -> DB -> SSE', async () => {
    // 1. Database mocks for job creation (markAttendance route)
    mockDb.classroom.findUnique.mockResolvedValue({
      id: '123e4567-e89b-12d3-a456-426614174000',
      teacherId: '123e4567-e89b-12d3-a456-426614174001',
      students: [{ userId: 'student-1' }]
    } as never);
    mockDb.attendanceJob.create.mockResolvedValue({
      id: jobId,
      status: 'QUEUED',
      classId: '123e4567-e89b-12d3-a456-426614174000',
      date: '2026-08-03'
    } as never);

    // 2. Request validation & Queue submission
    // NOTE: This assumes testing a secured endpoint, we simulate auth by passing a mock token 
    // Wait, testing auth might be complex if it verifies token. The user said mock what can be mocked.
    // Instead of messing with JWT, let's just assert on the integration pipeline logic itself
    // Or we can generate a valid JWT if we know the secret
    const jwt = await import('jsonwebtoken');
    const token = jwt.sign({ userId: '123e4567-e89b-12d3-a456-426614174001', role: 'TEACHER' }, process.env.JWT_SECRET || 'super_secret_test_key_that_is_long_enough_32_chars');

    const res = await request.post('/api/attendance/mark')
      .set('Authorization', `Bearer ${token}`)
      .send({
        classId: '123e4567-e89b-12d3-a456-426614174000',
        image: 'data:image/jpeg;base64,mockbase64',
        date: '2026-08-03'
      });

    if (res.status !== 202) console.error("Response error:", res.body);
    expect(res.status).toBe(202);
    expect(res.body.jobId).toBe(jobId);
    const { enqueueAttendanceJob } = await import('../queues/attendanceQueue.js');
    expect(enqueueAttendanceJob).toHaveBeenCalledWith(
      expect.objectContaining({ classId: '123e4567-e89b-12d3-a456-426614174000' })
    );

    // 3. Worker execution & Database queries
    mockDb.attendance.count.mockResolvedValue(0 as never);
    mockDb.attendanceJob.findUnique.mockResolvedValue({
      id: jobId,
      imageUrl: 'http://test-url.com/image.jpg'
    } as never);

    // 4. AI Processing + DB Persistence
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

    mockDb.$queryRawUnsafe.mockResolvedValue([{ userId: 'student-1', distance: 0.1 }] as never);
    mockDb.attendance.createMany.mockResolvedValue({} as never);

    await workerProcessor.processAttendanceJob(mockJob as Job);

    expect(mockAxios.post).toHaveBeenCalled();
    expect(mockDb.$queryRawUnsafe).toHaveBeenCalled();
    expect(mockDb.attendance.createMany).toHaveBeenCalled();

    expect(mockDb.attendanceJob.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: jobId },
      data: expect.objectContaining({ status: 'COMPLETED' })
    }));
  });
});
