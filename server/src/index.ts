import express from 'express';

import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { fileURLToPath } from 'url';

import authRoutes from './routes/authRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import classroomRoutes from './routes/classroomRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ESM replacement for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors()); // Fixes CORS issues
app.use(express.json({ limit: "50mb" })); // Parses JSON bodies
app.use(express.urlencoded({ limit: "50mb", extended: true })); // Increase urlencoded limit as well
app.use(morgan('dev')); // Logger

// Serve Static Files (Uploaded Images)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health Check
app.get('/', (req, res) => {
  res.send('SnapAttend API is running...');
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/classrooms', classroomRoutes);
app.use('/api/attendance', attendanceRoutes);

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});