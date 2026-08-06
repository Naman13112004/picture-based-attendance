import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createClassroom, getClassrooms } from '../controllers/classroomController.js';
import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/authMiddleware.js';
import db from '../config/db.js';

describe('Classroom Controller Tests', () => {
    let req: Partial<AuthRequest>;
    let res: Partial<Response>;

    const teacherId = 'teacher_test_id_1';
    const testClass = 'Test Class 101';

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

    describe('createClassroom', () => {
        it('should create a classroom and return 201', async () => {
            req.body = { name: testClass };
            jest.spyOn(db.classroom, 'create').mockResolvedValue({
                id: 'class-1',
                name: testClass,
                section: 'A',
                teacherId
            } as any);

            await createClassroom(req as AuthRequest, res as Response);

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                name: testClass
            }));
            expect(db.classroom.create).toHaveBeenCalled();
        });
    });

    describe('getClassrooms', () => {
        it('should fetch teacher classrooms', async () => {
            jest.spyOn(db.classroom, 'findMany').mockResolvedValue([
                { id: 'class-1', name: testClass, teacherId }
            ] as any);

            await getClassrooms(req as AuthRequest, res as Response);

            expect(db.classroom.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { teacherId }
            }));
            expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({ name: testClass })
            ]));
        });
    });
});
