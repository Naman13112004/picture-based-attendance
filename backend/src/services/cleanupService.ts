// src/services/cleanupService.ts
// Daily scheduled job — repurposed from class-photo cleanup to database
// integrity verification now that class photos are no longer stored on disk
// or in any cloud storage bucket.

import cron from 'node-cron';
import { Prisma } from '@prisma/client';
import db from '../config/db.js';

/**
 * Start the daily database integrity check.
 *
 * Runs every day at midnight (00:00 server time).
 *
 * Checks performed:
 *  1. Students with null faceEmbedding — these students cannot be recognized
 *     in attendance and should be prompted to re-upload their photos.
 *  2. Total attendance record count — useful for observability.
 *  3. Classrooms with no enrolled students — potential orphaned classes.
 *
 * All findings are logged to stdout. In a production environment these logs
 * should be piped to a structured logging service (Datadog, Loki, etc.)
 * or an alerting webhook.
 */
export const startCleanupJob = () => {
  cron.schedule('0 0 * * *', async () => {
    console.log('🔍 [Integrity Check] Running daily database integrity check...');

    try {
      // ── Check 1: Students with no face embeddings ──────────────────────────
      // Prisma's JSON nullable filter: { equals: Prisma.AnyNull } matches rows
      // where faceEmbedding IS NULL (SQL null, not JSON null).
      const profilesWithoutEmbeddings = await db.studentProfile.findMany({
        where: {
          faceEmbedding: {
            equals: Prisma.AnyNull,
          },
        },
        include: {
          user: {
            select: { name: true, email: true },
          },
        },
      });

      if (profilesWithoutEmbeddings.length === 0) {
        console.log(
          '✅ [Integrity Check] All registered students have face embeddings.',
        );
      } else {
        console.warn(
          `⚠️  [Integrity Check] ${profilesWithoutEmbeddings.length} student(s) ` +
          'have no face embeddings and cannot be recognized in attendance:',
        );
        for (const profile of profilesWithoutEmbeddings) {
          console.warn(
            `   - ${profile.user.name} <${profile.user.email}> (userId: ${profile.userId})`,
          );
        }
        console.warn(
          '   → Ask these students to re-upload their face photos via Settings.',
        );
      }

      // ── Check 2: Total attendance record count ────────────────────────────
      const attendanceCount = await db.attendance.count();
      console.log(
        `📊 [Integrity Check] Total attendance records in DB: ${attendanceCount.toLocaleString()}`,
      );

      // ── Check 3: Classrooms with no enrolled students ─────────────────────
      const emptyClassrooms = await db.classroom.findMany({
        where: { students: { none: {} } },
        select: { id: true, name: true, code: true },
      });

      if (emptyClassrooms.length > 0) {
        console.warn(
          `⚠️  [Integrity Check] ${emptyClassrooms.length} classroom(s) have no enrolled students:`,
        );
        for (const cls of emptyClassrooms) {
          console.warn(`   - "${cls.name}" (code: ${cls.code}, id: ${cls.id})`);
        }
      }

      console.log('✅ [Integrity Check] Daily integrity check completed.');

    } catch (err) {
      console.error('❌ [Integrity Check] Daily integrity check failed:', err);
    }
  });

  console.log('⏰ Daily database integrity check scheduled (runs at 00:00).');
};