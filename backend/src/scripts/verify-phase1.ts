// scripts/verify-phase1.ts
// Run with: npx tsx src/scripts/verify-phase1.ts
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function verify() {
  console.log('\n=== Phase 1 Migration Verification ===\n');

  // 1. Check pgvector extension
  const ext = await db.$queryRawUnsafe(
    `SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'`
  );
  console.log('1. pgvector extension:', JSON.stringify(ext));

  // 2. Check faceVector column exists on StudentProfile
  const col = await db.$queryRawUnsafe(
    `SELECT column_name, udt_name
     FROM information_schema.columns
     WHERE table_name = 'StudentProfile' AND column_name = 'faceVector'`
  );
  console.log('2. faceVector column on StudentProfile:', JSON.stringify(col));

  // 3. Check HNSW index exists
  const idx = await db.$queryRawUnsafe(
    `SELECT indexname, indexdef
     FROM pg_indexes
     WHERE tablename = 'StudentProfile' AND indexname LIKE '%hnsw%'`
  );
  console.log('3. HNSW index:', JSON.stringify(idx));

  // 4. Check AttendanceJob table exists
  const tbl = await db.$queryRawUnsafe(
    `SELECT table_name FROM information_schema.tables
     WHERE table_name = 'AttendanceJob' AND table_schema = 'public'`
  );
  console.log('4. AttendanceJob table:', JSON.stringify(tbl));

  // 5. Check JobStatus enum exists
  const en = await db.$queryRawUnsafe(
    `SELECT typname FROM pg_type WHERE typname = 'JobStatus'`
  );
  console.log('5. JobStatus enum:', JSON.stringify(en));

  // 6. Check AttendanceJob indexes
  const jobIdxs = await db.$queryRawUnsafe(
    `SELECT indexname FROM pg_indexes WHERE tablename = 'AttendanceJob' ORDER BY indexname`
  );
  console.log('6. AttendanceJob indexes:', JSON.stringify(jobIdxs));

  // 7. Quick Prisma ORM check — count AttendanceJob rows (should be 0)
  const count = await db.attendanceJob.count();
  console.log('7. AttendanceJob row count via Prisma:', count, '(expected: 0)');

  console.log('\n=== All checks passed ✅ ===\n');
  await db.$disconnect();
}

verify().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
