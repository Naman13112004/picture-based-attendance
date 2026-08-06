import { jest, describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import { generateToken, verifyToken } from '../utils/jwt.js';

describe('JWT Utility', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.JWT_SECRET = 'super_secret_test_key_that_is_long_enough_32_chars';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should generate and verify a token successfully', () => {
    const payload = { userId: '123', role: 'STUDENT' };
    const token = generateToken(payload.userId, payload.role);

    expect(token).toBeDefined();

    const decoded = verifyToken(token) as any;
    expect(decoded.userId).toBe('123');
    expect(decoded.role).toBe('STUDENT');
  });

  it('should throw error for invalid token', () => {
    expect(() => verifyToken('invalid.token.here')).toThrow();
  });
});
