/*
 * picture-based-attendance - A picture-based attendance system
 * Copyright (C) 2026 Naman Jain
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import express from 'express';

import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import axios from 'axios';
import { startCleanupJob } from './services/cleanupService.js';

import authRoutes from './routes/authRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import classroomRoutes from './routes/classroomRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';

dotenv.config();

// Start the cron job
startCleanupJob();

// Health Check Cron Job (every 5 minutes)
cron.schedule('*/5 * * * *', async () => {
  try {
    const aiBaseUrl = process.env.PYTHON_API_BASE_URL || 'http://127.0.0.1:8000';
    await axios.get(`${aiBaseUrl}/`);
    console.log('[Cron] AI Service health check passed.');
  } catch (error) {
    console.error('[Cron] AI Service health check failed:', (error as Error).message);
  }
});

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
