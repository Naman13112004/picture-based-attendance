import express from 'express';

import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';

import authRoutes from './routes/authRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import classroomRoutes from './routes/classroomRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Fixes CORS issues
app.use(express.json()); // Parses JSON bodies
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

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});