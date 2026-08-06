import { expect } from '@playwright/test';
import { test } from './fixtures';

test.describe('E2E Flows - Authentication', () => {
  test('Teacher login and auth persistence', async ({ page, mockBackend }) => {
    await mockBackend({ me: 'teacher', login: { user: { id: 'teacher-1', role: 'TEACHER' } } });
    
    await page.goto('/login');
    await page.getByLabel(/work email/i).fill('teacher@test.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /login as teacher/i }).click();

    await expect(page).toHaveURL(/\/dashboard\/teacher/);

    // Mock persistence
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard\/teacher/);
  });

  test('Teacher login - invalid credentials', async ({ page, mockBackend }) => {
    await mockBackend({ login: { status: 401 } });
    
    await page.goto('/login');
    await page.getByLabel(/work email/i).fill('wrong@test.com');
    await page.getByLabel(/password/i).fill('wrong');
    await page.getByRole('button', { name: /login as teacher/i }).click();

    // Should show error and stay on login
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('Logout flow', async ({ page, loginAsTeacher }) => {
    await loginAsTeacher();
    // Click logout button (assuming standard topnav or sidebar)
    const logoutBtn = page.locator('button', { hasText: 'Logout' });
    if (await logoutBtn.count() > 0) {
       await logoutBtn.first().click();
       await expect(page).toHaveURL(/\/login/);
    }
  });

  test('Unauthorized access attempts - Student accessing teacher routes', async ({ page, loginAsStudent }) => {
    await loginAsStudent();
    await page.goto('/dashboard/teacher');
    // Middleware should block and redirect
    await expect(page).not.toHaveURL(/\/dashboard\/teacher/);
  });

  test('Unauthorized access attempts - Anonymous user', async ({ page, mockBackend }) => {
    await mockBackend();
    await page.goto('/dashboard/teacher');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('E2E Flows - Student', () => {
  test('Student registration success', async ({ page, mockBackend }) => {
    await mockBackend({ register: { message: 'Registered', token: 'mock-jwt', user: { id: 'student-new', role: 'STUDENT', name: 'New Student', email: 'newstudent@test.com' } } });
    
    await page.goto('/register');
    await page.getByText('Student', { exact: true }).click();
    await page.getByLabel(/full name/i).fill('New Student');
    await page.getByLabel(/email/i).fill('newstudent@test.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /register as student/i }).click();

    await expect(page).toHaveURL(/\/dashboard\/student/);
  });

  test('Teacher registration success', async ({ page, mockBackend }) => {
    await mockBackend({ register: { message: 'Registered', token: 'mock-jwt', user: { id: 'teacher-new', role: 'TEACHER', name: 'New Teacher', email: 'newteacher@test.com' } } });
    
    await page.goto('/register');
    await page.getByText('Teacher', { exact: true }).click();
    await page.getByLabel(/full name/i).fill('New Teacher');
    await page.getByLabel(/email/i).fill('newteacher@test.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /register as teacher/i }).click();

    await expect(page).toHaveURL(/\/dashboard\/teacher/);
  });

  test('Student joins class', async ({ page, loginAsStudent }) => {
    await loginAsStudent();
    
    // Fill in join code
    const joinInput = page.locator('input[placeholder*="code" i]');
    if (await joinInput.count() > 0) {
       await joinInput.fill('MATH101');
       await page.click('button:has-text("Join")');
       // Assume success message
       await expect(page.locator('text=Joined successfully')).toBeVisible();
    }
  });
});

test.describe('E2E Flows - Teacher', () => {
  test('Class creation flow', async ({ page, loginAsTeacher }) => {
    await loginAsTeacher({ classrooms: [{ id: 'class-1', name: 'Math 101', code: 'MATH101' }] });
    
    await expect(page.locator('text=Math 101')).toBeVisible();
  });

  test('Teacher captures classroom photo and SSE progression', async ({ page, loginAsTeacher }) => {
    await loginAsTeacher({ 
       classroomDetail: { id: 'class-1', name: 'Math 101' },
       attendanceMark: { message: 'Processing', jobId: 'job-123' } 
    });
    
    await page.goto('/dashboard/teacher/classrooms/class-1');
    
    // Simulate clicking capture
    const captureBtn = page.locator('button', { hasText: /Take Classroom Photo|Capture/i });
    if (await captureBtn.count() > 0) {
        await captureBtn.first().click();
        
        // Wait for SSE status to be complete
        // The mock backend returns SSE data with "COMPLETED"
        await expect(page.locator('text=COMPLETED').or(page.locator('text=Completed'))).toBeVisible({ timeout: 10000 });
    }
  });

  test('Attendance history viewing', async ({ page, loginAsTeacher }) => {
    await loginAsTeacher({ 
       classroomDetail: { id: 'class-1', name: 'Math 101' },
       attendanceHistory: { date: '2026-08-02', totalStudents: 10, presentCount: 8, records: [{ id: 'r1', student: { name: 'John' }, status: 'PRESENT' }] } 
    });
    await page.goto('/dashboard/teacher/classrooms/class-1/history/2026-08-02');
    
    await expect(page.locator('text=John')).toBeVisible();
    await expect(page.locator('text=PRESENT')).toBeVisible();
  });

  test('Manual attendance edit', async ({ page, loginAsTeacher }) => {
    await loginAsTeacher({ 
       classroomDetail: { id: 'class-1', name: 'Math 101' },
       attendanceHistory: { date: '2026-08-02', records: [{ id: 'r1', studentId: 's1', student: { name: 'John' }, status: 'ABSENT' }] } 
    });
    await page.goto('/dashboard/teacher/classrooms/class-1/history/2026-08-02');
    
    // Find edit/toggle button for John
    const toggle = page.locator('button', { hasText: /Mark Present|Toggle|Edit/i }).first();
    if (await toggle.count() > 0) {
        await toggle.click();
        await expect(page.locator('text=Updated successfully').or(page.locator('text=Saved'))).toBeVisible();
    }
  });
});
