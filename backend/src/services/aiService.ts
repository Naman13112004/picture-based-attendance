// src/services/aiService.ts
// Centralised gateway for all communication with the Python FastAPI service.
// Every controller that needs AI inference goes through this module — never
// calls axios directly — so timeout config, base URL, and error handling
// live in exactly one place.

import axios, { AxiosError } from 'axios';
import type {
  StudentEmbeddingPayload,
  RecognitionResult,
  RegisterFaceResult,
  ExtractEmbeddingsResult,
} from '../types/ai.js';


// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = process.env.PYTHON_API_BASE_URL;
if (!BASE_URL) {
  throw new Error(
    'PYTHON_API_BASE_URL is not set. ' +
    'Add it to your .env file, e.g. PYTHON_API_BASE_URL=http://127.0.0.1:8000'
  );
}

/**
 * Milliseconds before an AI service request is aborted.
 * Registration (POST /register-face) is fast — one image, one face.
 * Recognition (POST /recognize) processes a full classroom photo, so it
 * gets a longer window.
 * Both are configurable via environment variables.
 */
const REGISTER_TIMEOUT_MS = parseInt(
  process.env.AI_REGISTER_TIMEOUT_MS ?? '15000',
  10,
);
const RECOGNIZE_TIMEOUT_MS = parseInt(
  process.env.AI_RECOGNIZE_TIMEOUT_MS ?? '45000',
  10,
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a human-readable error description from an Axios error.
 * Prefers the FastAPI `detail` field, falls back to the HTTP status text,
 * then to the low-level message.
 */
function describeAxiosError(err: AxiosError): string {
  if (err.response) {
    const data = err.response.data as Record<string, unknown> | undefined;
    const detail =
      typeof data?.['detail'] === 'string'
        ? data['detail']
        : JSON.stringify(data);
    return `HTTP ${err.response.status}: ${detail}`;
  }
  if (err.request) {
    return `No response from AI service (timeout or connection refused): ${err.message}`;
  }
  return err.message;
}

/** BUG-21: Returns true for transient errors that are worth retrying (5xx, network). */
function isTransientError(err: AxiosError): boolean {
  if (!err.response) return true;          // No response = network/timeout error
  return err.response.status >= 500;       // 5xx = server-side transient failure
  // 4xx = client error, will not self-resolve on retry
}

/** BUG-21: Sleep helper. */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Call POST /register-face to compute and return the SFace embedding for a
 * single student reference image.
 *
 * Called once per image during student face upload. The embedding is then
 * persisted in PostgreSQL so that attendance recognition never re-computes it.
 *
 * @param imageBase64  Base64-encoded image string (data URI prefix optional).
 * @param studentId    The student's User UUID (used for logging only).
 * @returns            The 128-D embedding as a number[], or null if the AI
 *                     service is unreachable or returns a 4xx validation error
 *                     (e.g. wrong number of faces). The caller decides whether
 *                     to fail the whole request or degrade gracefully.
 */
export const registerFace = async (
  imageBase64: string,
  studentId: string,
): Promise<number[] | null> => {
  try {
    const response = await axios.post<RegisterFaceResult>(
      `${BASE_URL}/register-face`,
      { image_b64: imageBase64, student_id: studentId },
      { timeout: REGISTER_TIMEOUT_MS },
    );
    return response.data.embedding;
  } catch (err) {
    const axiosErr = err as AxiosError;
    if (axios.isAxiosError(axiosErr)) {
      console.error(
        `[AI Service] register-face failed for student ${studentId}: ${describeAxiosError(axiosErr)}`,
      );
    } else {
      console.error(
        `[AI Service] register-face unexpected error for student ${studentId}:`,
        err,
      );
    }
    // Return null so the caller can degrade gracefully (save images, warn user)
    return null;
  }
};

/**
 * Call POST /recognize to identify which enrolled students are present in a
 * classroom photo.
 *
 * The classroom image is forwarded as Base64 — it is decoded in the AI service
 * entirely in memory and never written to any disk or storage service.
 *
 * Students are identified by their pre-computed embeddings (loaded from the
 * database by the caller). The AI service performs NO per-student downloads
 * and NO per-student face detection.
 *
 * @param classImageBase64  Base64-encoded classroom photo (data URI optional).
 * @param students          Enrolled students with their precomputed embeddings.
 * @returns                 Recognition result including present student IDs.
 * @throws                  Re-throws on network failure or unexpected 5xx so
 *                           the attendance controller can return an appropriate
 *                           HTTP error to the frontend.
 */
export const recognizeFaces = async (
  classImageBase64: string,
  students: StudentEmbeddingPayload[],
): Promise<RecognitionResult> => {
  // BUG-21: One retry for transient failures (5xx / network timeout).
  // 4xx errors are not retried — they indicate a client problem that won't resolve.
  const MAX_ATTEMPTS = 2;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await axios.post<RecognitionResult>(
        `${BASE_URL}/recognize`,
        { class_image_b64: classImageBase64, students },
        { timeout: RECOGNIZE_TIMEOUT_MS },
      );
      return response.data;
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axios.isAxiosError(axiosErr)) {
        const description = describeAxiosError(axiosErr);
        if (attempt < MAX_ATTEMPTS && isTransientError(axiosErr)) {
          console.warn(
            `[AI Service] recognize attempt ${attempt} failed (${description}). Retrying in 1s...`,
          );
          await sleep(1000);
          lastError = new Error(`AI service error during recognition: ${description}`);
          continue;
        }
        console.error(`[AI Service] recognize failed: ${description}`);
        throw new Error(`AI service error during recognition: ${description}`);
      }
      throw err;
    }
  }

  // Should not reach here, but TypeScript needs a return path
  throw lastError ?? new Error('AI service recognition failed after retries.');
};

/**
 * Call POST /extract-embeddings to detect all faces in a classroom photo and
 * return their 128-D embeddings — WITHOUT performing any student matching.
 *
 * This is the Phase 5 pgvector path. The worker calls this endpoint to get
 * the raw face embeddings, then matches them against enrolled students using
 * a pgvector cosine-distance query directly in PostgreSQL (HNSW index).
 *
 * Advantages over /recognize:
 *   - Payload is O(faces × 128) instead of O(students × faces × 128).
 *   - No student data ever leaves the database tier.
 *   - Matching scales with the DB, not with Python worker concurrency.
 *
 * @param classImageBase64  Base64-encoded classroom photo (data URI optional).
 * @returns                 List of 128-D float arrays, one per detected face.
 *                          Empty array if no faces are detected.
 * @throws                  Re-throws on network failure or 5xx after one retry
 *                          so the worker can propagate the error and retry the job.
 */
export const extractFaceEmbeddings = async (
  classImageBase64: string,
): Promise<ExtractEmbeddingsResult> => {
  const MAX_ATTEMPTS = 2;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await axios.post<ExtractEmbeddingsResult>(
        `${BASE_URL}/extract-embeddings`,
        { class_image_b64: classImageBase64 },
        { timeout: RECOGNIZE_TIMEOUT_MS },
      );
      return response.data;
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axios.isAxiosError(axiosErr)) {
        const description = describeAxiosError(axiosErr);
        if (attempt < MAX_ATTEMPTS && isTransientError(axiosErr)) {
          console.warn(
            `[AI Service] extract-embeddings attempt ${attempt} failed (${description}). Retrying in 1s...`,
          );
          await sleep(1000);
          lastError = new Error(`AI service error during extraction: ${description}`);
          continue;
        }
        console.error(`[AI Service] extract-embeddings failed: ${description}`);
        throw new Error(`AI service error during extraction: ${description}`);
      }
      throw err;
    }
  }

  throw lastError ?? new Error('AI service extraction failed after retries.');
};

