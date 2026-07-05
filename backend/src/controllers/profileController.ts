// src/controllers/profileController.ts
import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/authMiddleware.js';
import { Prisma } from '@prisma/client';
import db from '../config/db.js';
import { saveBase64Image } from '../utils/fileHelper.js';
import { registerFace } from '../services/aiService.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safely cast a Prisma JsonValue to number[][] after runtime validation.
 * Returns null if the value is absent, not an array, or structurally invalid.
 */
function parseFaceEmbedding(raw: unknown): number[][] | null {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return null;
  const valid = (raw as unknown[]).every(
    (vec) =>
      Array.isArray(vec) &&
      (vec as unknown[]).length === 128 &&
      (vec as unknown[]).every((n) => typeof n === 'number'),
  );
  return valid ? (raw as number[][]) : null;
}

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

/**
 * POST /api/profile/upload-faces
 *
 * Accepts exactly 3 Base64-encoded face photos from a student.
 *
 * Pipeline:
 *  1. Validate payload (3 images required).
 *  2. Upload all 3 images to Supabase Storage in parallel.
 *  3. Call /register-face on the AI service for each image in parallel.
 *     - Uses Promise.allSettled so a single bad photo never blocks the rest.
 *  4. Collect all successful embeddings.
 *  5. Persist image URLs + embeddings to the StudentProfile row in one update.
 *  6. Return a structured response with an embedding status field:
 *     - "complete"  → all 3 embeddings registered
 *     - "partial"   → 1 or 2 of 3 embeddings registered (warns user)
 *     - "none"      → 0 embeddings registered (warns user to re-upload)
 *
 * The image URLs (faceData1/2/3) are always persisted even when embedding
 * extraction fails, so the student's photos are visible in the UI immediately.
 * The student will not be recognized in attendance until at least one embedding
 * is present.
 */
export const updateStudentImages = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const userId = req.user.userId;
    const { images } = req.body as { images?: unknown };

    if (!Array.isArray(images) || images.length !== 3) {
      return res.status(400).json({
        message: 'Please provide exactly 3 images as a JSON array.',
      });
    }

    // Validate every entry is a non-empty string before expensive I/O
    const imageStrings = images as unknown[];
    for (let i = 0; i < imageStrings.length; i++) {
      if (typeof imageStrings[i] !== 'string' || !(imageStrings[i] as string).trim()) {
        return res.status(400).json({
          message: `Image at index ${i} is missing or not a valid Base64 string.`,
        });
      }
    }

    const [img1, img2, img3] = imageStrings as [string, string, string];

    // ── Step 1: Upload images to Supabase in parallel ───────────────────────
    // These are the public URLs stored in the DB for UI display purposes.
    let path1: string, path2: string, path3: string;
    try {
      [path1, path2, path3] = await Promise.all([
        saveBase64Image(img1, userId, 'face_1.jpg'),
        saveBase64Image(img2, userId, 'face_2.jpg'),
        saveBase64Image(img3, userId, 'face_3.jpg'),
      ]);
    } catch (uploadError) {
      console.error('[Profile] Supabase upload failed:', uploadError);
      return res.status(500).json({ message: 'Error uploading images to storage.' });
    }

    // ── Step 2: Register embeddings in parallel with the AI service ──────────
    // allSettled ensures one failing image never prevents the others from
    // being processed. Failures are surfaced as warnings, not hard errors.
    const embeddingResults = await Promise.allSettled([
      registerFace(img1, userId),
      registerFace(img2, userId),
      registerFace(img3, userId),
    ]);

    const successfulEmbeddings: number[][] = [];
    const failedPhotoIndices: number[] = [];

    embeddingResults.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value !== null) {
        successfulEmbeddings.push(result.value);
      } else {
        failedPhotoIndices.push(idx + 1); // 1-indexed for the user-facing message
        if (result.status === 'rejected') {
          console.error(`[Profile] Embedding extraction failed for photo ${idx + 1}:`, result.reason);
        } else {
          // AI service returned null (e.g. 422 — wrong number of faces)
          console.warn(`[Profile] No embedding returned for photo ${idx + 1} (student: ${userId})`);
        }
      }
    });

    // ── Step 3: Persist to database in a single update ──────────────────────
    // faceEmbedding is set to the array of successful embeddings, or null if
    // none succeeded. Prisma accepts number[][] directly as a Json value.
    await db.studentProfile.update({
      where: { userId },
      data: {
        faceData1: path1,
        faceData2: path2,
        faceData3: path3,
        faceEmbedding: successfulEmbeddings.length > 0
          ? (successfulEmbeddings as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });

    // ── Step 4: Build structured response ───────────────────────────────────
    const embeddingsRegistered = successfulEmbeddings.length;

    if (embeddingsRegistered === 0) {
      // No embeddings stored — student will not be recognized until re-upload
      console.warn(
        `[Profile] No embeddings stored for student ${userId}. ` +
        'AI service may be unavailable.',
      );
      return res.status(207).json({
        message: 'Face photos uploaded but embeddings could not be registered.',
        urls: [path1, path2, path3],
        embeddings_registered: 0,
        embedding_status: 'none',
        warning:
          'Your face photos were saved but could not be processed by the ' +
          'recognition service. You will not be detected in attendance until ' +
          'you re-upload your photos. Please try again later.',
      });
    }

    if (failedPhotoIndices.length > 0) {
      // Partial success — some photos were processed, some were not
      return res.status(200).json({
        message: 'Face data updated with partial embeddings.',
        urls: [path1, path2, path3],
        embeddings_registered: embeddingsRegistered,
        embedding_status: 'partial',
        warning:
          `${failedPhotoIndices.length} of 3 photo(s) could not be processed ` +
          `(photo ${failedPhotoIndices.join(', ')}). ` +
          'Ensure each photo shows exactly one clear, well-lit face. ' +
          'Recognition may be less accurate.',
      });
    }

    // Full success
    return res.status(200).json({
      message: 'Face data updated successfully.',
      urls: [path1, path2, path3],
      embeddings_registered: embeddingsRegistered,
      embedding_status: 'complete',
    });

  } catch (error) {
    console.error('[Profile] updateStudentImages error:', error);
    return res.status(500).json({ message: 'Error saving profile images.' });
  }
};

/**
 * GET /api/profile
 *
 * Returns the authenticated student's profile row.
 * The faceEmbedding column is excluded from the response — embeddings are
 * binary ML artefacts, not user-facing data.
 */
export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const profile = await db.studentProfile.findUnique({
      where: { userId: req.user.userId },
      select: {
        id: true,
        userId: true,
        faceData1: true,
        faceData2: true,
        faceData3: true,
        // faceEmbedding intentionally omitted — not for client consumption
      },
    });

    if (!profile) {
      return res.status(404).json({ message: 'Profile not found.' });
    }

    return res.json(profile);
  } catch (error) {
    console.error('[Profile] getProfile error:', error);
    return res.status(500).json({ message: 'Error fetching profile.' });
  }
};