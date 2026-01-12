import type { Request, Response } from 'express';
import db from '../config/db.js';
import bcrypt from 'bcrypt';
import { generateToken } from '../utils/jwt.js';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user exists
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create User
    const user = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role, // Ensure frontend sends "STUDENT" or "TEACHER"
        // If student, create empty profile
        ...(role === "STUDENT" && {
            studentProfiles: { create: {} },
        })
      },
    });

    const token = generateToken(user.id, user.role);
    res.status(201).json({ token, user: { id: user.id, name: user.name, role: user.role } });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.password) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = generateToken(user.id, user.role);
    res.json({ token, user: { id: user.id, name: user.name, role: user.role } });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const googleLogin = async (req: Request, res: Response) => {
    try {
        const { token, role } = req.body; // 'token' here is the Access Token

        // 1. Verify Token & Get User Info from Google
        const googleRes = await axios.get(`https://www.googleapis.com/oauth2/v3/userinfo`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const { email, name, picture, sub } = googleRes.data;

        if (!email) return res.status(400).json({ message: "Google account has no email" });

        // 2. Find or Create User
        let user = await db.user.findUnique({ where: { email } });

        if (!user) {
            // Create new user
            // Use the role passed from frontend, or default to STUDENT
            const userRole = role === "TEACHER" ? "TEACHER" : "STUDENT";

            user = await db.user.create({
                data: {
                    email,
                    name,
                    role: userRole,
                    avatar: picture,
                    ...(userRole === "STUDENT" && {
                      studentProfiles: { create: {} },
                    }),
                }
            });
        }

        // 3. Generate our App's JWT
        const appToken = generateToken(user.id, user.role);

        res.json({ 
            token: appToken, 
            user: { id: user.id, name: user.name, role: user.role, avatar: user.avatar } 
        });

    } catch (error) {
        console.error("Google Auth Error:", error);
        res.status(500).json({ message: "Google Authentication failed" });
    }
}