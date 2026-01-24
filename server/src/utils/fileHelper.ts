import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from '../config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUCKET_NAME = process.env.SUPABASE_BUCKET || 'snapattend-uploads';

/**
 * Uploads a Base64 image string to Supabase Storage and returns the Public URL.
 * @param base64String The raw base64 string from the frontend
 * @param folder The folder path within the bucket (e.g., 'class_photos' or 'user_123')
 * @param filename The desired filename
 */
export const saveBase64Image = async (base64String: string, folder: string, filename: string): Promise<string> => {
  // 1. Validate input
  const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid base64 string format');
  }

  const contentType = matches[1]; // e.g., 'image/jpeg'
  const base64Data = matches[2];  // The actual data

  if(!contentType) {
    throw new Error('content type error');
  }

  if(!base64Data) {
    throw new Error('Data not found');
  }

  // 2. Convert Base64 to Buffer (Node.js handles this natively)
  const buffer = Buffer.from(base64Data, 'base64');

  // 3. Define the path in the bucket
  // Supabase paths shouldn't start with /
  const filePath = `${folder}/${filename}`;

  // 4. Upload to Supabase
  // We use upsert: true to overwrite if it exists (optional)
  const { data, error } = await supabase
    .storage
    .from(BUCKET_NAME)
    .upload(filePath, buffer, {
      contentType: contentType,
      upsert: true 
    });

  if (error) {
    console.error("Supabase Upload Error:", error);
    throw new Error('Failed to upload image to storage');
  }

  // 5. Get Public URL
  // This URL is what we will save in the database
  const { data: publicUrlData } = supabase
    .storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
};