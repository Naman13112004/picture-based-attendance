// server/src/controllers/attendanceController.ts
import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/authMiddleware.js';
import db from '../config/db.js';
import { saveBase64Image } from '../utils/fileHelper.js';
import axios from 'axios';

const PYTHON_API_URL = process.env.PYTHON_API_URL!;

export const markAttendance = async (req: AuthRequest, res: Response) => {
    try {
        const { classId, image } = req.body; // image is Base64 string of class photo

        // 1. Save Class Photo
        const filename = `class_${classId}_${Date.now()}.jpg`;
        // Save in 'class_photos' folder
        const classImagePath = saveBase64Image(image, 'class_photos', filename);

        // 2. Fetch Enrolled Students & Their Reference Photos
        const classroom = await db.classroom.findUnique({
            where: { id: classId },
            include: {
                students: true // Includes the StudentProfile
            }
        });

        if (!classroom) return res.status(404).json({ message: "Classroom not found" });

        // Prepare data for Python
        const pythonPayload = {
            class_image_path: classImagePath, // e.g. "/uploads/class_photos/..."
            students: classroom.students.map(student => ({
                id: student.userId, // We identify them by UserID
                image_paths: [
                    student.faceData1, 
                    student.faceData2, 
                    student.faceData3
                ].filter(path => path !== null) as string[] // Remove nulls
            }))
        };

        // 3. Call Python AI Service
        console.log("Calling Python AI Service...");
        const aiResponse = await axios.post(PYTHON_API_URL, pythonPayload);
        
        const { present_student_ids } = aiResponse.data;
        console.log("AI Results:", present_student_ids);

        // 4. Update Database
        // We create attendance records for ALL students in the class
        const today = new Date();
        
        // Transaction ensures all records are created or none
        await db.$transaction(async (tx) => {
            // First, delete any existing attendance for this class/date to prevent duplicates (optional logic)
            // For MVP, we just create new records
            
            for (const student of classroom.students) {
                const isPresent = present_student_ids.includes(student.userId);
                
                await tx.attendance.create({
                    data: {
                        date: today,
                        status: isPresent ? "PRESENT" : "ABSENT",
                        studentId: student.userId,
                        classId: classId
                    }
                });
            }
        });

        res.json({ 
            message: "Attendance marked successfully",
            results: aiResponse.data
        });

    } catch (error) {
        console.error("Attendance Error:", error);
        res.status(500).json({ message: "Error processing attendance" });
    }
}