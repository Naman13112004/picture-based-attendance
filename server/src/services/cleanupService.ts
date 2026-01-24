import cron from 'node-cron';
import { supabase } from '../config/supabase.js';

const BUCKET_NAME = process.env.SUPABASE_BUCKET || 'snapattend-uploads';
const FOLDER = 'class_photos';

// Run every day at midnight (00:00)
export const startCleanupJob = () => {
    cron.schedule('0 0 * * *', async () => {
        console.log('🧹 Running daily cleanup job for old class photos...');
        
        try {
            // 1. List all files in the class_photos folder
            const { data: files, error } = await supabase
                .storage
                .from(BUCKET_NAME)
                .list(FOLDER, { limit: 1000 }); // Adjust limit as needed

            if (error) {
                console.error('Error listing files for cleanup:', error);
                return;
            }

            if (!files || files.length === 0) return;

            // 2. Identify files older than 24 hours
            const now = new Date();
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

            const filesToDelete = files
                .filter(file => {
                    const created = new Date(file.created_at); // Supabase returns created_at
                    return created < oneDayAgo;
                })
                .map(file => `${FOLDER}/${file.name}`); // Construct full path

            if (filesToDelete.length === 0) {
                console.log('No old files to delete.');
                return;
            }

            // 3. Delete them
            const { error: deleteError } = await supabase
                .storage
                .from(BUCKET_NAME)
                .remove(filesToDelete);

            if (deleteError) {
                console.error('Error deleting old files:', deleteError);
            } else {
                console.log(`✅ Successfully deleted ${filesToDelete.length} old class photos.`);
            }

        } catch (err) {
            console.error('Cleanup job failed:', err);
        }
    });
};