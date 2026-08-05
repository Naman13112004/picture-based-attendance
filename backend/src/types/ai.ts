// src/types/ai.ts
// Shared TypeScript contracts for Node.js ↔ FastAPI communication.
// These types mirror the Pydantic models in ai-service/models.py exactly.

/**
 * A single student's pre-computed SFace embeddings sent to FastAPI.
 * No image URLs, no downloads — embeddings come straight from the database.
 *
 * embeddings: Up to 3 L2-normalized 128-D float vectors (one per reference photo).
 *
 * @deprecated Used only by the legacy /recognize endpoint.
 *             Phase 5 uses extractFaceEmbeddings() + pgvector instead.
 */
export interface StudentEmbeddingPayload {
  id: string;
  embeddings: number[][];
}

/**
 * Response from POST /recognize.
 * Schema is unchanged from the original — all consumer code continues to work.
 *
 * @deprecated Prefer the pgvector path (extractFaceEmbeddings + DB query).
 */
export interface RecognitionResult {
  total_faces_detected: number;
  present_student_ids: string[];
  absent_count: number;
}

/**
 * Response from POST /register-face.
 * The embedding is a flat 128-D float vector ready to be stored in PostgreSQL.
 */
export interface RegisterFaceResult {
  student_id: string;
  embedding: number[];
}

/**
 * Response from POST /extract-embeddings (Phase 5 — pgvector path).
 *
 * The AI service detects all faces in the classroom photo and returns their
 * raw 128-D embeddings. The Node.js worker then uses pgvector to match each
 * embedding against enrolled students directly in PostgreSQL.
 */
export interface ExtractEmbeddingsResult {
  face_count: number;
  embeddings: number[][];
}

/**
 * A single pgvector similarity search result row.
 * Returned by the worker's raw SQL query against StudentProfile.faceVector.
 */
export interface VectorMatchRow {
  /** Enrolled student userId */
  userId: string;
  /** pgvector cosine distance (0 = identical, 2 = opposite) */
  distance: number;
}

/**
 * Structured error thrown when the AI service returns a 4xx/5xx response.
 * Carries the HTTP status and the FastAPI `detail` message for logging.
 */
export interface AiServiceError {
  status: number;
  detail: string;
}
