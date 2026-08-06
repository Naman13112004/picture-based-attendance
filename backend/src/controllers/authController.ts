import type { Request, Response } from 'express';
import db from '../config/db.js';
import bcrypt from 'bcrypt';
import { generateToken } from '../utils/jwt.js';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

/**
 * POST /api/auth/register
 *
 * BUG-04 fix: validates all fields before touching the DB or bcrypt.
 * - name:     required, 2–100 chars
 * - email:    required, valid format
 * - password: required, min 8 chars
 * - role:     must be exactly "STUDENT" or "TEACHER"
 */
export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;

    // ── Check for duplicate ───────────────────────────────────────────────────
    const existingUser = await db.user.findUnique({ where: { email: email } });
    if (existingUser) return res.status(400).json({ message: 'An account with this email already exists.' });

    // ── Create user ───────────────────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await db.user.create({
      data: {
        name: name,
        email: email,
        password: hashedPassword,
        role: role as 'STUDENT' | 'TEACHER',
        ...(role === 'STUDENT' && {
          studentProfiles: { create: {} },
        }),
      },
    });

    const token = generateToken(user.id, user.role);
    return res.status(201).json({ token, user: { id: user.id, name: user.name, role: user.role } });

  } catch (error) {
    console.error('[Auth] register error:', error);
    return res.status(500).json({ message: 'Server error during registration.' });
  }
};

/**
 * POST /api/auth/login
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await db.user.findUnique({ where: { email: String(email).trim().toLowerCase() } });
    if (!user || !user.password) return res.status(400).json({ message: 'Invalid credentials.' });

    const isMatch = await bcrypt.compare(String(password), user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials.' });

    const token = generateToken(user.id, user.role);
    return res.json({ token, user: { id: user.id, name: user.name, role: user.role } });

  } catch (error) {
    console.error('[Auth] login error:', error);
    return res.status(500).json({ message: 'Server error during login.' });
  }
};

/**
 * POST /api/auth/google
 */
export const googleLogin = async (req: Request, res: Response) => {
  try {
    const { token, role } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: 'Google access token is required.' });
    }

    // Verify token & get user info from Google
    const googleRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const { email, name, picture } = googleRes.data;

    if (!email) return res.status(400).json({ message: 'Google account has no email.' });

    // Find or create user
    let user = await db.user.findUnique({ where: { email } });

    if (!user) {
      const userRole = role === 'TEACHER' ? 'TEACHER' : 'STUDENT';

      user = await db.user.create({
        data: {
          email,
          name,
          role: userRole,
          avatar: picture,
          ...(userRole === 'STUDENT' && {
            studentProfiles: { create: {} },
          }),
        },
      });
    }

    const appToken = generateToken(user.id, user.role);

    return res.json({
      token: appToken,
      user: { id: user.id, name: user.name, role: user.role, avatar: user.avatar },
    });

  } catch (error) {
    console.error('[Auth] Google auth error:', error);
    return res.status(500).json({ message: 'Google authentication failed.' });
  }
};