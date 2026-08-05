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

/**
 * Compute the mean of a list of 128-D float vectors, then L2-normalise the
 * result so it can be stored as a unit vector in the pgvector column.
 *
 * Averaging multiple face photos and normalising gives a representative
 * "centroid" embedding that pgvector can compare efficiently with cosine
 * distance (<=> operator).
 *
 * @param embeddings  1-3 L2-normalised 128-D SFace vectors.
 * @returns           L2-normalised mean vector as a flat number[].
 */
function computeMeanAndNormalize(embeddings: number[][]): number[] {
  const dim  = 128;
  const mean = new Array<number>(dim).fill(0);

  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      mean[i] = (mean[i] ?? 0) + (emb[i] ?? 0);
    }
  }
  for (let i = 0; i < dim; i++) {
    mean[i] = (mean[i] ?? 0) / embeddings.length;
  }

  // L2 normalise so cosine distance is equivalent to Euclidean distance
  const norm = Math.sqrt(mean.reduce((s, v) => s + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < dim; i++) mean[i] = (mean[i] ?? 0) / norm;
  }

  return mean;
}

/**
 * BUG-06: Determines whether an image string is a newly captured Base64 image
 * or an existing Supabase HTTPS URL (loaded from the DB on mount).
 *
 * Returns true if the string looks like a raw data URI (Base64-encoded image).
 * Returns false for HTTPS URLs or any other non-Base64 value.
 */
function isBase64DataUri(s: string): boolean {
  return s.startsWith('data:image/') && s.includes(';base64,');
}

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

/**
 * POST /api/profile/upload-faces
 *
 * BUG-06 fix: The frontend sends `images` where each slot is either:
 *   - A new Base64 data URI (newly captured by the student)
 *   - An existing Supabase HTTPS URL (unchanged, loaded from DB on mount)
 *   - null (empty slot — rejected, all 3 must be filled)
 *
 * For Base64 slots: upload to Supabase + register embedding with AI service.
 * For URL slots:    skip re-upload, skip re-embedding, keep existing DB values.
 *
 * This prevents the data corruption bug where saving an unchanged profile
 * would send HTTPS URLs to saveBase64Image (crash) and wipe faceEmbedding.
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

    // Validate: every entry must be a non-empty string
    const imageStrings = images as unknown[];
    for (let i = 0; i < imageStrings.length; i++) {
      if (typeof imageStrings[i] !== 'string' || !(imageStrings[i] as string).trim()) {
        return res.status(400).json({
          message: `Image at index ${i} is missing or not a valid string.`,
        });
      }
    }

    const [img1, img2, img3] = imageStrings as [string, string, string];

    // BUG-06: Load existing profile to get current DB values for unchanged slots
    const existingProfile = await db.studentProfile.findUnique({
      where: { userId },
      select: { faceData1: true, faceData2: true, faceData3: true, faceEmbedding: true },
    });

    const existingUrls = [
      existingProfile?.faceData1 ?? null,
      existingProfile?.faceData2 ?? null,
      existingProfile?.faceData3 ?? null,
    ];
    const existingEmbeddings = parseFaceEmbedding(existingProfile?.faceEmbedding) ?? [];

    // ── Step 1: Upload only NEW Base64 images to Supabase ────────────────────
    const uploadSlot = async (img: string, existingUrl: string | null, filename: string) => {
      if (isBase64DataUri(img)) {
        return saveBase64Image(img, userId, filename); // new capture → upload
      }
      return existingUrl ?? img; // already a URL → keep it
    };

    let path1: string, path2: string, path3: string;
    try {
      [path1, path2, path3] = await Promise.all([
        uploadSlot(img1, existingUrls[0] ?? null, 'face_1.jpg'),
        uploadSlot(img2, existingUrls[1] ?? null, 'face_2.jpg'),
        uploadSlot(img3, existingUrls[2] ?? null, 'face_3.jpg'),
      ]);
    } catch (uploadError) {
      console.error('[Profile] Supabase upload failed:', uploadError);
      return res.status(500).json({ message: 'Error uploading images to storage.' });
    }

    // ── Step 2: Register embeddings only for NEW images ──────────────────────
    // For unchanged URL slots we reuse the existing embeddings (if any).
    // This prevents re-registering and potentially losing existing embeddings.
    const imgs = [img1, img2, img3];
    const isNew = imgs.map(isBase64DataUri);
    const newCount = isNew.filter(Boolean).length;

    let successfulEmbeddings: number[][];
    const failedPhotoIndices: number[] = [];

    if (newCount === 0) {
      // BUG-06: No new images — nothing changed. Return existing data.
      return res.status(200).json({
        message: 'No changes detected. Profile data is already up to date.',
        urls: [path1, path2, path3],
        embeddings_registered: existingEmbeddings.length,
        embedding_status: existingEmbeddings.length === 3 ? 'complete'
          : existingEmbeddings.length > 0 ? 'partial' : 'none',
      });
    }

    // Only call AI for new images; keep existing embedding vectors for unchanged slots
    const embeddingResults = await Promise.allSettled(
      imgs.map((img, i) =>
        isNew[i] ? registerFace(img, userId) : Promise.resolve(existingEmbeddings[i] ?? null),
      ),
    );

    successfulEmbeddings = [];
    embeddingResults.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value !== null) {
        successfulEmbeddings.push(result.value);
      } else {
        if (isNew[idx]) {
          failedPhotoIndices.push(idx + 1);
          if (result.status === 'rejected') {
            console.error(`[Profile] Embedding extraction failed for photo ${idx + 1}:`, result.reason);
          } else {
            console.warn(`[Profile] No embedding returned for photo ${idx + 1} (student: ${userId})`);
          }
        }
      }
    });

    // ── Step 3: Persist to database ──────────────────────────────────────────
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

    // ── Step 3b: Write mean embedding to faceVector (pgvector column) ────────
    // The pgvector column stores the L2-normalised mean of all successful
    // embeddings. The Phase 5 worker uses this for HNSW cosine-distance search.
    if (successfulEmbeddings.length > 0) {
      try {
        const meanEmbedding  = computeMeanAndNormalize(successfulEmbeddings);
        const vectorLiteral  = `[${meanEmbedding.join(',')}]`;
        await db.$executeRawUnsafe(
          `UPDATE "StudentProfile" SET "faceVector" = $1::vector WHERE "userId" = $2`,
          vectorLiteral,
          userId,
        );
        console.log(`[Profile] faceVector updated for student ${userId}.`);
      } catch (vecErr) {
        // Non-fatal: faceEmbedding (JSONB) is already saved above.
        // The pgvector path skips students where faceVector IS NULL.
        // Student can re-upload to fix this.
        console.warn(`[Profile] faceVector update failed for ${userId}:`, vecErr);
      }
    }

    // ── Step 4: Structured response ──────────────────────────────────────────
    if (successfulEmbeddings.length === 0) {
      console.warn(`[Profile] No embeddings stored for student ${userId}.`);
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
      return res.status(200).json({
        message: 'Face data updated with partial embeddings.',
        urls: [path1, path2, path3],
        embeddings_registered: successfulEmbeddings.length,
        embedding_status: 'partial',
        warning:
          `${failedPhotoIndices.length} of ${newCount} new photo(s) could not be processed ` +
          `(photo ${failedPhotoIndices.join(', ')}). ` +
          'Ensure each photo shows exactly one clear, well-lit face. ' +
          'Recognition may be less accurate.',
      });
    }

    return res.status(200).json({
      message: 'Face data updated successfully.',
      urls: [path1, path2, path3],
      embeddings_registered: successfulEmbeddings.length,
      embedding_status: 'complete',
    });

  } catch (error) {
    console.error('[Profile] updateStudentImages error:', error);
    return res.status(500).json({ message: 'Error saving profile images.' });
  }
};

/**
 * GET /api/profile
 * Returns the authenticated user's profile row (embeddings excluded).
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