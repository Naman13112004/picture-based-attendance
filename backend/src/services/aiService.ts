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
      console.error(`[AI Service] recognize failed: ${description}`);
      throw new Error(`AI service error during recognition: ${description}`);
    }
    throw err;
  }
};
