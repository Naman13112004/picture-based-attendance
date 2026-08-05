import { test as base } from '@playwright/test';

interface MockLoginResponse {
  status?: number;
  user?: {
    id: string;
    role: "TEACHER" | "STUDENT";
  };
}

interface MockUserResponse {
  user: {
    id: string;
    role: "TEACHER" | "STUDENT";
    name: string;
    email: string;
    faceVector?: number[];
  };
}

type MockResponses = {
  me?: MockUserResponse | "teacher" | "student";
  login?: MockLoginResponse;
  register?: Record<string, unknown>;
  classrooms?: unknown[];
  classroomDetail?: Record<string, unknown>;
  attendanceMark?: Record<string, unknown>;
  attendanceHistory?: Record<string, unknown>;
};

export const test = base.extend<{
  mockBackend: (responses?: MockResponses) => Promise<void>;
  loginAsTeacher: (responses?: MockResponses) => Promise<void>;
  loginAsStudent: (responses?: MockResponses) => Promise<void>;
}>({
  mockBackend: async ({ page, context }, use) => {
    await use(async (responses: MockResponses = {}) => {
      // Common Mocks
      await page.route('**/api/auth/me', async route => {
        const cookies = await context.cookies();
        const token = cookies.find(c => c.name === 'token');
        if (token) {
          if (responses.me === 'teacher') {
            await route.fulfill({ status: 200, json: { user: { id: 'teacher-1', role: 'TEACHER', name: 'Test Teacher', email: 'teacher@test.com' } } });
          } else if (responses.me === 'student') {
            await route.fulfill({ status: 200, json: { user: { id: 'student-1', role: 'STUDENT', name: 'Test Student', email: 'student@test.com', faceVector: [] } } });
          } else {
            await route.fulfill({ status: 200, json: responses.me });
          }
        } else {
          await route.fulfill({ status: 401, json: { message: 'Unauthorized' } });
        }
      });

      await page.route('**/api/auth/login', async route => {
        if (responses.login?.status === 401) {
          await route.fulfill({ status: 401, json: { message: 'Invalid credentials' } });
        } else {
          await route.fulfill({ status: 200, json: { message: 'Login successful', token: 'mock-jwt-token', user: responses.login?.user || { id: 'teacher-1', role: 'TEACHER' } } });
        }
      });

      await page.route('**/api/auth/register', async route => {
        await route.fulfill({
          status: 201,
          json: responses.register || {
            message: 'Registered successfully',
            token: 'mock-jwt-token',
            user: {
              id: 'student-new',
              role: 'STUDENT',
              name: 'New Student',
              email: 'newstudent@test.com'
            }
          }
        });
      });

      await page.route('**/api/classrooms', async route => {
        if (route.request().method() === 'GET') {
          await route.fulfill({ status: 200, json: responses.classrooms || [] });
        } else if (route.request().method() === 'POST') {
          await route.fulfill({ status: 201, json: { id: 'class-new', name: 'New Class', code: 'NEW123' } });
        } else {
          await route.continue();
        }
      });

      await page.route('**/api/classrooms/join', async route => {
        await route.fulfill({ status: 200, json: { message: 'Joined successfully' } });
      });

      await page.route('**/api/classrooms/*', async route => {
        if (route.request().method() === 'GET') {
          await route.fulfill({ status: 200, json: responses.classroomDetail || { id: 'class-1', name: 'Math 101', code: 'MATH101', students: [] } });
        } else {
          await route.continue();
        }
      });

      await page.route('**/api/attendance/mark', async route => {
        await route.fulfill({ status: 202, json: responses.attendanceMark || { message: 'Processing...', jobId: 'job-123', status: 'QUEUED', date: '2026-08-02' } });
      });

      await page.route('**/api/attendance/job/*/stream', async route => {
        // Send SSE headers and content
        const headers = { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' };
        const streamData = `data: {"type":"status","status":"COMPLETED","result":{"presentCount":1,"totalCount":1}}\n\n`;
        await route.fulfill({ status: 200, headers, body: streamData });
      });

      await page.route('**/api/attendance/history/*', async route => {
        await route.fulfill({ status: 200, json: responses.attendanceHistory || { date: '2026-08-02', totalStudents: 1, presentCount: 1, records: [] } });
      });

      await page.route('**/api/attendance/manual', async route => {
        await route.fulfill({ status: 200, json: { message: 'Updated successfully' } });
      });
    });
  },
  loginAsTeacher: async ({ page, context, mockBackend }, use) => {
    await use(async (responses: MockResponses = {}) => {
      await mockBackend({ ...responses, me: 'teacher', login: { user: { id: 'teacher-1', role: 'TEACHER' } } });
      await context.addCookies([
        { name: 'token', value: 'mock-jwt-token', url: 'http://localhost:3000' },
        { name: 'user', value: encodeURIComponent(JSON.stringify({ id: 'teacher-1', role: 'TEACHER' })), url: 'http://localhost:3000' }
      ]);
      await page.goto('/dashboard/teacher');
    });
  },
  loginAsStudent: async ({ page, context, mockBackend }, use) => {
    await use(async (responses: MockResponses = {}) => {
      await mockBackend({ ...responses, me: 'student', login: { user: { id: 'student-1', role: 'STUDENT' } } });
      await context.addCookies([
        { name: 'token', value: 'mock-jwt-token', url: 'http://localhost:3000' },
        { name: 'user', value: encodeURIComponent(JSON.stringify({ id: 'student-1', role: 'STUDENT' })), url: 'http://localhost:3000' }
      ]);
      await page.goto('/dashboard/student');
    });
  }
});
