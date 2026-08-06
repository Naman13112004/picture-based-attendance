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
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import axios from 'axios';
import { startCleanupJob } from './services/cleanupService.js';
import { correlationMiddleware } from './middlewares/correlationMiddleware.js';
import { globalLimiter } from './middlewares/rateLimitMiddleware.js';
import { serverAdapter } from "./config/bullBoard.js";
import basicAuth from "express-basic-auth";

import authRoutes from './routes/authRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import classroomRoutes from './routes/classroomRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';

dotenv.config();

// Start the cleanup cron job
startCleanupJob();

// AI service health-check cron (every 5 minutes)
cron.schedule('*/5 * * * *', async () => {
  try {
    const aiBaseUrl = process.env.PYTHON_API_BASE_URL || 'http://127.0.0.1:8000';
    await axios.get(`${aiBaseUrl}/`);
    console.log('[Cron] AI Service health check passed.');
  } catch (error) {
    console.error('[Cron] AI Service health check failed:', (error as Error).message);
  }
});

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = express();
const PORT = process.env.PORT || 5000;

// ---------------------------------------------------------------------------
// Security middleware (Phase 4)
// ---------------------------------------------------------------------------

// 1. Correlation ID — must be first so all downstream handlers can log it
app.use(correlationMiddleware);

// 2. Helmet — sets secure HTTP response headers (X-Frame-Options, HSTS, etc.)
//    CSP is disabled because the API is JSON-only; no HTML is served.
app.use(
  helmet({
    contentSecurityPolicy: false, // API server — no HTML/CSS/JS served
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  }),
);

// 3. CORS — restricted to the known frontend origin(s)
//    CORS_ORIGIN may be a comma-separated list for staging + prod.
//    Trailing slashes are stripped for safe comparison.
const rawOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''));

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no Origin header (server-to-server, Postman in dev)
      if (!origin) return callback(null, true);
      const normalised = origin.replace(/\/$/, '');
      if (rawOrigins.includes(normalised)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: Origin "${origin}" is not allowed.`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id'],
    exposedHeaders: ['X-Correlation-Id', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    credentials: true,
  }),
);

// 4. Global rate limiter — 200 req/min per IP safety net across all /api routes
app.use('/api', globalLimiter);

// ---------------------------------------------------------------------------
// Body parsing — tightened limit from 50 MB to 10 MB (Phase 4)
// Base64 images are the heaviest payload. A 5 MP JPEG compresses to ~2–4 MB
// as base64. 10 MB allows a pair of images with room to spare.
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------
app.use(morgan('dev'));

// ---------------------------------------------------------------------------
// Health check (unauthenticated — used by docker-compose and load balancers)
// ---------------------------------------------------------------------------
app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'SnapAttend API' });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/classrooms', classroomRoutes);
app.use('/api/attendance', attendanceRoutes);

// ---------------------------------------------------------------------------
// Bull Board (Queue Dashboard)
// ---------------------------------------------------------------------------
app.use("/admin/queues",
  basicAuth({
    users: {
      [process.env.BULL_BOARD_USERNAME! || "admin"]: process.env.BULL_BOARD_PASSWORD! || "password123",
    },
    challenge: true,
  }),
  serverAdapter.getRouter()
);

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Global Error]', err.message);

  // CORS errors from the origin check above
  if (err.message.startsWith('CORS:')) {
    res.status(403).json({ message: err.message });
    return;
  }

  res.status(500).json({ message: 'An unexpected error occurred.' });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`[Server] SnapAttend API running on port ${PORT}`);
});
export default app;
