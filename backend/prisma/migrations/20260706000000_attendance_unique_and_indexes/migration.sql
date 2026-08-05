-- attendance_unique_and_indexes
-- BUG-02: Adds a unique constraint on (studentId, classId, date) to prevent
--         duplicate attendance records from being created when a teacher
--         processes attendance more than once for the same class on the same day.
--         skipDuplicates in createMany() is a no-op without this constraint.
--
-- BUG-19: Adds indexes to the Attendance table to speed up the two hot queries:
--   1. getStudentStats   → filters by studentId
--   2. getClassAttendanceHistory → filters by classId + date range
--
-- BUG-02/16: Removes the @default(now()) from the date column so the controller
--            can supply the teacher's local date (normalised to UTC midnight)
--            rather than always using server time.

-- Remove the server-side default so the controller sets the date explicitly
ALTER TABLE "public"."Attendance" ALTER COLUMN "date" DROP DEFAULT;

-- Index: fast lookup by student across all classes
CREATE INDEX "Attendance_studentId_idx" ON "public"."Attendance"("studentId");

-- Index: fast lookup by class for a date range (getClassAttendanceHistory hot path)
CREATE INDEX "Attendance_classId_date_idx" ON "public"."Attendance"("classId", "date");

-- Unique constraint: one record per student per class per date
-- If duplicates exist from before this migration they must be cleaned up first.
-- The cleanup below keeps only the latest PRESENT record (or latest ABSENT if
-- the student was never present that day) for each (studentId, classId, date::date)
-- group, then normalises all existing dates to UTC midnight so the constraint works.
DO $$
BEGIN
  -- Step 1: Delete duplicates, keeping the record most recently inserted
  --         and preferring PRESENT over ABSENT in case of same-second ties.
  DELETE FROM "public"."Attendance"
  WHERE id IN (
    SELECT id FROM (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY "studentId", "classId", date_trunc('day', date)
               ORDER BY
                 CASE WHEN status = 'PRESENT' THEN 0 ELSE 1 END,
                 date DESC
             ) AS rn
      FROM "public"."Attendance"
    ) ranked
    WHERE rn > 1
  );

  -- Step 2: Normalise all existing dates to UTC midnight so the unique
  --         constraint operates on date-granularity, not timestamp-granularity.
  UPDATE "public"."Attendance"
  SET date = date_trunc('day', date);
END $$;

-- Now safe to add the unique constraint
CREATE UNIQUE INDEX "Attendance_studentId_classId_date_key"
  ON "public"."Attendance"("studentId", "classId", "date");
