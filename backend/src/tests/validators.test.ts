import { describe, it, expect } from '@jest/globals';
import { registerSchema, loginSchema } from '../schemas/authSchema.js';

describe('Validator Tests', () => {
    describe('registerSchema', () => {
        it('should validate valid data', () => {
            const data = {
                name: 'John Doe',
                email: 'john@example.com',
                password: 'password123',
                role: 'STUDENT'
            };
            const result = registerSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should reject invalid email', () => {
            const data = {
                name: 'John Doe',
                email: 'not-an-email',
                password: 'password123',
                role: 'STUDENT'
            };
            const result = registerSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });

    describe('loginSchema', () => {
        it('should validate valid data', () => {
            const data = {
                email: 'john@example.com',
                password: 'password123'
            };
            const result = loginSchema.safeParse(data);
            expect(result.success).toBe(true);
        });
    });
});
