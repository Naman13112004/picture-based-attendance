from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import cv2
import numpy as np
import os
from typing import List

app = FastAPI()

BASE_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..")
)

def resolve_upload_path(relative_path: str) -> str:
    clean_path = relative_path.lstrip("/")  # remove leading slash
    return os.path.join(BASE_DIR, clean_path)

# --- Data Models (Schema) ---
# This defines what data Node.js sends to us
class Student(BaseModel):
    id: str
    image_paths: List[str]  # ["uploads/user1/face1.jpg", "uploads/user1/face2.jpg"]

class AttendanceRequest(BaseModel):
    class_image_path: str   # "uploads/class_photos/class_101.jpg"
    students: List[Student] # List of all students in that class

# --- Helper Function ---
def get_face_encodings(image_path: str):
    import face_recognition
    """
    Loads an image and returns the 128-dimensional face encoding.
    Returns None if no face is found or file doesn't exist.
    """
    # Adjust path relative to where you run the python script
    # We assume 'uploads' is in the parent directory of 'python-service'
    full_path = resolve_upload_path(image_path)

    if not os.path.exists(full_path):
        print(f"File not found: {full_path}")
        return []

    try:
        # Load image
        image = face_recognition.load_image_file(full_path)
        # Get encodings (machine readable face data)
        encodings = face_recognition.face_encodings(image)
        return encodings
    except Exception as e:
        print(f"Error processing {full_path}: {e}")
        return []

# --- Main Endpoint ---
@app.post("/recognize")
async def recognize_faces(data: AttendanceRequest):
    import face_recognition
    print(f"Processing class image: {data.class_image_path}")
    
    # 1. Process the Class Photo
    full_class_path = resolve_upload_path(data.class_image_path)
    if not os.path.exists(full_class_path):
        raise HTTPException(status_code=404, detail="Class photo not found")

    try:
        class_image = face_recognition.load_image_file(full_class_path)
        # Find all face locations and encodings in the group photo
        # model="hog" is faster (CPU), "cnn" is more accurate (GPU required)
        class_face_locations = face_recognition.face_locations(class_image, model="hog")
        class_face_encodings = face_recognition.face_encodings(class_image, class_face_locations)
        
        print(f"Found {len(class_face_encodings)} faces in class photo.")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing class photo: {str(e)}")

    present_students = []

    # 2. Iterate through each enrolled student to check if they are present
    for student in data.students:
        student_known_encodings = []

        # Load all 3 reference photos for this student
        for img_path in student.image_paths:
            encs = get_face_encodings(img_path)
            if encs:
                student_known_encodings.extend(encs)
        
        if not student_known_encodings:
            print(f"Skipping student {student.id}: No valid reference photos found.")
            continue

        # 3. Compare Student References vs All Class Faces
        # We check if ANY of the student's reference faces match ANY face in the class photo
        match_found = False
        
        # 'tolerance' is how strict the match is. Lower (e.g. 0.5) is stricter, 0.6 is standard.
        tolerance = 0.6 

        for known_encoding in student_known_encodings:
            # compare_faces returns a list of True/False for each face in class_face_encodings
            matches = face_recognition.compare_faces(class_face_encodings, known_encoding, tolerance=tolerance)
            
            if True in matches:
                match_found = True
                break
        
        if match_found:
            present_students.append(student.id)

    # Return the results
    return {
        "total_faces_detected": len(class_face_encodings),
        "present_student_ids": present_students,
        "absent_count": len(data.students) - len(present_students)
    }

# Health Check
@app.get("/")
def read_root():
    return {"status": "AI Service is Running"}