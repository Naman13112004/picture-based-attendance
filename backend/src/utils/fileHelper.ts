import { supabase } from '../config/supabase.js';

// Bucket names from environment (with safe fallbacks)
const PROFILE_BUCKET   = process.env.SUPABASE_BUCKET          || 'snapattend-uploads';
const CLASSROOM_BUCKET = process.env.CLASSROOM_PHOTOS_BUCKET   || 'classroom-photos';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// ---------------------------------------------------------------------------
// Core helper — generic Supabase bucket upload
// ---------------------------------------------------------------------------

/**
 * Decodes a base64 data-URI string, validates its MIME type, and uploads the
 * resulting buffer to the given Supabase Storage bucket.
 *
 * @param base64String  Data-URI string: `data:<mime>;base64,<payload>`
 * @param bucket        Target bucket name (must exist in Supabase).
 * @param folder        Folder path inside the bucket (no leading slash).
 * @param filename      Desired filename (including extension).
 * @returns             Public URL of the uploaded file.
 */
async function uploadBase64ToSupabase(
  base64String: string,
  bucket:       string,
  folder:       string,
  filename:     string,
): Promise<string> {
  // 1. Parse & validate data-URI
  const matches = base64String.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid base64 string format — expected data:<mime>;base64,<payload>.');
  }

  const contentType = matches[1] as string;
  const base64Data  = matches[2] as string;

  if (!ALLOWED_MIME_TYPES.has(contentType)) {
    throw new Error(
      `Unsupported image type: ${contentType}. ` +
      'Only JPEG, PNG, and WebP are allowed.',
    );
  }

  if (!base64Data) throw new Error('Empty base64 payload.');

  // 2. Decode to Buffer
  const buffer = Buffer.from(base64Data, 'base64');

  // 3. Upload to Supabase Storage
  const filePath = `${folder}/${filename}`;
  const { error } = await supabase
    .storage
    .from(bucket)
    .upload(filePath, buffer, { contentType, upsert: true });

  if (error) {
    console.error('[Storage] Supabase upload error:', error);
    throw new Error('Failed to upload image to storage.');
  }

  // 4. Return the public URL
  const { data: urlData } = supabase
    .storage
    .from(bucket)
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Upload a student face photo to the student-profiles bucket.
 * Used by profileController when a student registers their face images.
 *
 * @param base64String  Data-URI encoded image.
 * @param folder        Sub-folder inside the bucket (e.g. the studentId).
 * @param filename      Desired filename.
 * @returns             Public URL.
 */
export const saveBase64Image = (
  base64String: string,
  folder:       string,
  filename:     string,
): Promise<string> => uploadBase64ToSupabase(base64String, PROFILE_BUCKET, folder, filename);

/**
 * Upload a classroom attendance photo to the classroom-photos bucket.
 * Used by attendanceController when a teacher submits a classroom image.
 * Files are stored under `classrooms/<classId>/<filename>`.
 *
 * @param base64String  Data-URI encoded image.
 * @param classId       Classroom UUID (used as sub-folder for easy cleanup).
 * @param filename      Desired filename — typically `<date>-<timestamp>.jpg`.
 * @returns             Public URL stored in AttendanceJob.imageUrl.
 */
export const saveClassroomImage = (
  base64String: string,
  classId:      string,
  filename:     string,
): Promise<string> =>
  uploadBase64ToSupabase(base64String, CLASSROOM_BUCKET, `classrooms/${classId}`, filename);