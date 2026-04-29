// src/controllers/profileController.ts
import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/authMiddleware.js';
import db from '../config/db.js';
import { saveBase64Image } from '../utils/fileHelper.js';

export const updateStudentImages = async (req: AuthRequest, res: Response) => {
    try {
        const { images } = req.body; // Expecting array of 3 base64 strings

        if (!req.user?.userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = req.user.userId;

        if (!images || !Array.isArray(images) || images.length !== 3) {
            return res.status(400).json({ message: "Please provide exactly 3 images." });
        }

        // Save images to disk
        // We use the UserID as a folder name to keep things organized
        const path1 = await saveBase64Image(images[0], userId!, 'face_1.jpg');
        const path2 = await saveBase64Image(images[1], userId!, 'face_2.jpg');
        const path3 = await saveBase64Image(images[2], userId!, 'face_3.jpg');

        // Update DB
        await db.studentProfile.update({
            where: { userId: userId },
            data: {
                faceData1: path1,
                faceData2: path2,
                faceData3: path3,
            }
        });

        res.json({ message: "Face data updated successfully", urls: [path1, path2, path3] });

    } catch (error) {
        console.error("Profile Upload Error:", error);
        res.status(500).json({ message: 'Error saving profile images' });
    }
};

export const getProfile = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const profile = await db.studentProfile.findUnique({
            where: { userId: req.user.userId }
        });
        res.json(profile);
    } catch (error) {
        res.status(500).json({ message: "Error fetching profile" });
    }
}