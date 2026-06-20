# picture-based-attendance - A picture-based attendance system
# Copyright (C) 2026 Naman Jain
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import AttendanceRequest, Student
from model_manager import initialize_models
from config import MAX_WORKERS
from pipeline.image_loader import load_image_from_url
from pipeline.detector import detect_faces
from pipeline.embedder import get_embeddings, get_single_embedding
from pipeline.matcher import match_student
from pipeline.preprocessor import enhance_image

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Download and initialize face detection/recognition models on startup."""
    print("Initializing face recognition pipeline...")
    initialize_models()
    print("Pipeline ready.")


def _process_student(student: Student, class_embeddings: list) -> str | None:
    """
    Process a single student: download reference photos, detect faces,
    extract embeddings, and check for a match against class embeddings.

    Returns the student ID if present, None otherwise.
    """
    student_known_embeddings = []

    for img_url in student.image_paths:
        if not img_url:
            continue

        # Download reference photo
        ref_image = load_image_from_url(img_url)
        if ref_image is None:
            continue

        # Preprocess the reference photo
        ref_image = enhance_image(ref_image)

        # Detect face(s) in reference photo
        ref_faces = detect_faces(ref_image)
        if ref_faces is None:
            print(f"  No face found in reference photo for {student.id}: {img_url}")
            continue

        # Extract embedding from the first (primary) face in the reference
        embedding = get_single_embedding(ref_image, ref_faces[0])
        student_known_embeddings.append(embedding)

    if not student_known_embeddings:
        print(f"Skipping student {student.id}: No valid reference embeddings.")
        return None

    # Match against class photo faces
    if match_student(student_known_embeddings, class_embeddings):
        print(f"Student {student.id}: PRESENT")
        return student.id

    print(f"Student {student.id}: ABSENT")
    return None


# --- Main Endpoint ---
@app.post("/recognize")
async def recognize_faces(data: AttendanceRequest):
    print(f"Processing class image: {data.class_image_path}")

    # 1. Download and Process the Class Photo
    class_image = load_image_from_url(data.class_image_path)

    if class_image is None:
        raise HTTPException(
            status_code=400, detail="Could not download class photo from URL"
        )

    # Preprocess the class photo
    class_image = enhance_image(class_image)

    # 2. Detect all faces in the class photo
    class_faces = detect_faces(class_image)

    if class_faces is None:
        print("No faces detected in class photo.")
        return {
            "total_faces_detected": 0,
            "present_student_ids": [],
            "absent_count": len(data.students),
        }

    # 3. Extract embeddings for all detected class faces
    class_embeddings = get_embeddings(class_image, class_faces)
    print(f"Found {len(class_embeddings)} faces in class photo.")

    # 4. Process each student concurrently
    present_students = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {
            executor.submit(_process_student, student, class_embeddings): student
            for student in data.students
        }

        for future in futures:
            result = future.result()
            if result is not None:
                present_students.append(result)

    # Return the results (same format as before)
    return {
        "total_faces_detected": len(class_embeddings),
        "present_student_ids": present_students,
        "absent_count": len(data.students) - len(present_students),
    }


# Health Check
@app.get("/")
def read_root():
    return {"status": "AI Service is Running"}
