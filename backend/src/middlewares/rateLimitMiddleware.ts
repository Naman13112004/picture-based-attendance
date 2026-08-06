// src/middlewares/rateLimitMiddleware.ts
// Pre-configured express-rate-limit instances for different route groups.
// express-slow-down is added to the login route to progressively delay
// responses after repeated rapid attempts (brute-force mitigation).

import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

// ---------------------------------------------------------------------------
// Auth limiter — login, register, Google OAuth
// ---------------------------------------------------------------------------

/**
 * Limits credential-submission endpoints to 15 requests per 15-minute window
 * per IP. Resets the window after 15 minutes.
 *
 * Applied to: POST /api/auth/login, POST /api/auth/register, POST /api/auth/google
 */
export const authLimiter = rateLimit({
  windowMs:  15 * 60 * 1000, // 15 minutes
  max:       15,
  message:   { message: 'Too many requests from this IP — please try again in 15 minutes.' },
  standardHeaders: true,  // Return rate limit info in RateLimit-* headers
  legacyHeaders:   false, // Disable X-RateLimit-* headers (deprecated)
});

// ---------------------------------------------------------------------------
// Login slow-down — brute-force mitigation
// ---------------------------------------------------------------------------

/**
 * Adds a progressive delay to login responses after 5 rapid requests.
 * Each additional request beyond the threshold adds 500 ms (up to 20 s max).
 * This makes automated credential-stuffing painful without blocking humans.
 *
 * Applied to: POST /api/auth/login
 */
export const loginSlowDown = slowDown({
  windowMs:          15 * 60 * 1000, // 15-minute window
  delayAfter:        5,               // start delaying after 5 requests
  delayMs:           (used) => (used - 5) * 500, // +500 ms per req beyond threshold
  maxDelayMs:        20_000,          // cap at 20 s
});

// ---------------------------------------------------------------------------
// Attendance limiter — image upload → AI pipeline
// ---------------------------------------------------------------------------

/**
 * Limits each IP to 10 attendance submissions per 5-minute window.
 * A single teacher will rarely submit more than 1–2 per 5 minutes, so this
 * gives comfortable headroom while blocking bulk abuse.
 *
 * Applied to: POST /api/attendance/mark
 */
export const attendanceLimiter = rateLimit({
  windowMs:  5 * 60 * 1000, // 5 minutes
  max:       10,
  message:   { message: 'Too many attendance submissions — please wait before retrying.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// ---------------------------------------------------------------------------
// Profile upload limiter — face image registration
// ---------------------------------------------------------------------------

/**
 * Limits each IP to 20 face-upload requests per 10-minute window.
 * Face registration is infrequent; this blocks bulk enumeration of the
 * Supabase bucket path while allowing normal usage patterns.
 *
 * Applied to: POST /api/profile/upload-faces
 */
export const profileUploadLimiter = rateLimit({
  windowMs:  10 * 60 * 1000, // 10 minutes
  max:       20,
  message:   { message: 'Too many image uploads — please try again shortly.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// ---------------------------------------------------------------------------
// General API limiter — catch-all for all /api/* routes
// ---------------------------------------------------------------------------

/**
 * Global safety-net: 200 requests per minute per IP across all API routes.
 * Applied at the app level in index.ts. This prevents runaway scrapers from
 * hammering non-rate-limited endpoints.
 */
export const globalLimiter = rateLimit({
  windowMs:  60 * 1000, // 1 minute
  max:       200,
  message:   { message: 'Rate limit exceeded — slow down.' },
  standardHeaders: true,
  legacyHeaders:   false,
  skip: (req) => req.path === '/' || req.path === '/health', // don't limit health checks
});
