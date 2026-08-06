// src/scripts/backfill-face-vectors.ts
// One-time migration: populate the faceVector (pgvector) column from the
// existing faceEmbedding (JSONB) column for all students who already have
// face embeddings registered but haven't re-uploaded since Phase 5 was deployed.
//
// Run with: npx tsx src/scripts/backfill-face-vectors.ts
//
// Safe to run multiple times — it skips students who already have faceVector set.
// Prints a summary table at the end.

import 'dotenv/config';
import db from '../config/db.js';

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

function computeMeanAndNormalize(embeddings: number[][]): number[] {
  const dim  = 128;
  const mean = new Array<number>(dim).fill(0);

  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) mean[i] = (mean[i] ?? 0) + (emb[i] ?? 0);
  }
  for (let i = 0; i < dim; i++) mean[i] = (mean[i] ?? 0) / embeddings.length;

  const norm = Math.sqrt(mean.reduce((s, v) => s + v * v, 0));
  if (norm > 0) for (let i = 0; i < dim; i++) mean[i] = (mean[i] ?? 0) / norm;

  return mean;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  console.log('\n=== Phase 5 — faceVector Backfill ===\n');

  // 1. Find all students who have faceEmbedding (JSONB) but no faceVector.
  //    We query faceVector IS NULL via raw SQL since Prisma can't filter on
  //    an Unsupported column type.
  const candidates = await db.$queryRaw<Array<{ userId: string; faceEmbedding: unknown }>>`
    SELECT sp."userId", sp."faceEmbedding"
    FROM "StudentProfile" sp
    WHERE sp."faceEmbedding" IS NOT NULL
      AND sp."faceEmbedding" != 'null'::jsonb
      AND sp."faceVector" IS NULL
  `;

  console.log(`Students needing backfill: ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('Nothing to do — all students with embeddings already have faceVector set.\n');
    await db.$disconnect();
    return;
  }

  let successCount = 0;
  let skipCount    = 0;
  let errorCount   = 0;

  for (const row of candidates) {
    const embeddings = parseFaceEmbedding(row.faceEmbedding);

    if (!embeddings || embeddings.length === 0) {
      console.warn(`  SKIP  ${row.userId} — invalid or empty faceEmbedding JSON`);
      skipCount++;
      continue;
    }

    try {
      const mean          = computeMeanAndNormalize(embeddings);
      const vectorLiteral = `[${mean.join(',')}]`;

      await db.$executeRawUnsafe(
        `UPDATE "StudentProfile" SET "faceVector" = $1::vector WHERE "userId" = $2`,
        vectorLiteral,
        row.userId,
      );

      console.log(`  OK    ${row.userId} (${embeddings.length} embedding(s) → mean vector)`);
      successCount++;
    } catch (err) {
      console.error(`  ERROR ${row.userId}:`, err instanceof Error ? err.message : err);
      errorCount++;
    }
  }

  // 2. Verify — count how many students now have faceVector set.
  const withVector = await db.$queryRaw<Array<{ count: string }>>`
    SELECT COUNT(*)::text AS count
    FROM "StudentProfile"
    WHERE "faceVector" IS NOT NULL
  `;

  console.log('\n─────────────────────────────────────────');
  console.log(`Processed : ${candidates.length}`);
  console.log(`Success   : ${successCount}`);
  console.log(`Skipped   : ${skipCount}`);
  console.log(`Errors    : ${errorCount}`);
  console.log(`Total with faceVector in DB: ${withVector[0]?.count ?? 0}`);
  console.log('─────────────────────────────────────────\n');

  if (errorCount > 0) {
    console.warn('Some students failed to backfill. Re-running the script is safe.');
    process.exit(1);
  }

  console.log('Backfill complete ✅\n');
  await db.$disconnect();
}

run().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
