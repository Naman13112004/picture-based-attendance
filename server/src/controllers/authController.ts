import type { Request, Response } from 'express';
import db from '../config/db.js';
import bcrypt from 'bcrypt';
import { generateToken } from '../utils/jwt.js';
import { OAuth2Client } from 'google-auth-library';

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
    res.status(500).json({ message: 'Server error' });
  }
};

export const googleLogin = async (req: Request, res: Response) => {
    try {
        const { token } = req.body; // Token from frontend Google Button
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID!
        });
        
        const payload = ticket.getPayload();
        if(!payload || !payload.email) return res.status(400).json({message: "Invalid Google Token"});

        let user = await db.user.findUnique({ where: { email: payload.email }});

        if (!user) {
            // Register new user via Google
            // Note: In a real app, you might want to ask for Role if it's a new Google user. 
            // For MVP, we might default to STUDENT or error out. 
            // Let's assume we pass a 'role' from frontend along with token for new users
            const role = req.body.role || "STUDENT"; 

            user = await db.user.create({
                data: {
                    email: payload.email,
                    name: payload.name || "User",
                    role: role,
                    avatar: payload.picture ?? null,
                    ...(role === "STUDENT" && {
                        studentProfiles: { create: {} },
                    })
                }
            });
        }

        const jwtToken = generateToken(user.id, user.role);
        res.json({ token: jwtToken, user: { id: user.id, name: user.name, role: user.role } });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Google Auth Failed"});
    }
}