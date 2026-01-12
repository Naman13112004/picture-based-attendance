import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const saveBase64Image = (base64String: string, folder: string, filename: string) => {
  // Remove header (e.g., "data:image/jpeg;base64,")
  const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  
  if (!matches) {
    throw new Error('Invalid input string');
  }

  const [, , base64Data] = matches;

  if(!base64Data) {
    throw new Error('Invalid base64 data');
  }

  const imageBuffer = Buffer.from(base64Data, 'base64');
  const uploadDir = path.join(__dirname, '../../../uploads', folder);

  // Ensure directory exists
  if (!fs.existsSync(uploadDir)){
      fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filePath = path.join(uploadDir, filename);
  fs.writeFileSync(filePath, imageBuffer);

  return `/uploads/${folder}/${filename}`; // Return relative path for DB
};