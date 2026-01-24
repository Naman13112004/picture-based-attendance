from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import face_recognition
import numpy as np
import requests
from io import BytesIO
from typing import List

app = FastAPI()

# --- Data Models (Schema) ---
class Student(BaseModel):
    id: str
    image_paths: List[str]  # Now expects Full URLs: ["https://supa.../face1.jpg", ...]

class AttendanceRequest(BaseModel):
    class_image_path: str   # Now expects Full URL: "https://supa.../class_101.jpg"
    students: List[Student]

# --- Helper Function: Download Image ---
def load_image_from_url(url: str):
    """
    Downloads an image from a URL and converts it to a numpy array 
    usable by face_recognition.
    """
    try:
        response = requests.get(url, timeout=10) # 10s timeout
        response.raise_for_status() # Raise error for 404/500
        
        # Load image from bytes
        # face_recognition.load_image_file accepts a file-like object (BytesIO)
        image = face_recognition.load_image_file(BytesIO(response.content))
        return image
    except Exception as e:
        print(f"Failed to download or load image from {url}: {e}")
        return None

# --- Helper Function: Get Encodings ---
def get_face_encodings(image_url: str):
    """
    Loads an image from URL and returns the 128-dimensional face encoding.
    """
    image = load_image_from_url(image_url)
    
    if image is None:
        return []

    try:
        # Get encodings
        encodings = face_recognition.face_encodings(image)
        return encodings
    except Exception as e:
        print(f"Error processing encodings for {image_url}: {e}")
        return []

# --- Main Endpoint ---
@app.post("/recognize")
async def recognize_faces(data: AttendanceRequest):
    print(f"Processing class image: {data.class_image_path}")
    
    # 1. Download and Process the Class Photo
    class_image = load_image_from_url(data.class_image_path)
    
    if class_image is None:
        raise HTTPException(status_code=400, detail="Could not download class photo from URL")

    try:
        # Find all face locations and encodings in the group photo
        # model="hog" is faster (CPU), "cnn" is more accurate (GPU required)
        class_face_locations = face_recognition.face_locations(class_image, model="hog")
        class_face_encodings = face_recognition.face_encodings(class_image, class_face_locations)
        
        print(f"Found {len(class_face_encodings)} faces in class photo.")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing class photo: {str(e)}")

    present_students = []

    # 2. Iterate through each enrolled student
    for student in data.students:
        student_known_encodings = []

        # Load reference photos from URLs
        for img_url in student.image_paths:
            # Skip empty URLs if any
            if not img_url: 
                continue
                
            encs = get_face_encodings(img_url)
            if encs:
                student_known_encodings.extend(encs)
        
        if not student_known_encodings:
            print(f"Skipping student {student.id}: No valid reference photos downloaded.")
            continue

        # 3. Compare Student References vs All Class Faces
        match_found = False
        tolerance = 0.6 

        for known_encoding in student_known_encodings:
            # Compare against all faces in the class
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