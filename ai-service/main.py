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

import logging

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from config import SIMILARITY_THRESHOLD
from model_manager import initialize_models, get_detector, get_recognizer
from models import (
    AttendanceRequest,
    RecognitionResponse,
    RegisterFaceRequest,
    RegisterFaceResponse,
)
from pipeline.detector import detect_faces
from pipeline.embedder import get_embeddings, get_single_embedding
from pipeline.image_loader import load_image_from_b64
from pipeline.matcher import build_class_matrix, match_student_vectorized
from pipeline.preprocessor import enhance_image

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ai-service")

app = FastAPI(
    title="SnapAttend AI Service",
    description=(
        "Face detection and recognition pipeline for picture-based attendance. "
        "Provides pre-computation of student embeddings at registration time and "
        "fully vectorized matching at attendance time."
    ),
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------


@app.on_event("startup")
async def startup_event() -> None:
    """Download and initialize face detection/recognition models on startup."""
    logger.info("Initializing face recognition pipeline...")
    initialize_models()
    logger.info("Pipeline ready.")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


@app.get("/", tags=["health"])
def read_root() -> dict:
    """Basic liveness check."""
    return {"status": "AI Service is Running", "version": "2.0.0"}


# ---------------------------------------------------------------------------
# Registration endpoint — called once per student face upload
# ---------------------------------------------------------------------------


@app.post("/register-face", response_model=RegisterFaceResponse, tags=["registration"])
async def register_face(data: RegisterFaceRequest) -> RegisterFaceResponse:
    """
    Extract and return the SFace embedding for a single student reference photo.

    This endpoint is called by the Node.js backend whenever a student uploads
    or updates their face photo(s). The returned embedding is persisted in
    PostgreSQL so that recognition never needs to process student reference
    images again.

    Pipeline:
        1. Decode Base64 image from memory (no disk I/O)
        2. Preprocess (CLAHE, sharpening, upscale if needed)
        3. Detect faces with YuNet
        4. Validate exactly one face is present
        5. Extract 128-D SFace embedding
        6. Return the embedding as a flat float list

    Raises:
        400: Image could not be decoded (corrupted / invalid Base64 / wrong format)
        422: Zero faces detected, or more than one face detected
        503: AI models not yet initialized
    """
    logger.info("register-face: student_id=%s", data.student_id)

    # 1. Decode image from Base64 in memory
    image = load_image_from_b64(data.image_b64)
    if image is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Could not decode image. Ensure the payload is a valid Base64-encoded "
                "JPEG, PNG, or WebP image, with or without a data URI prefix."
            ),
        )

    # 2. Preprocess
    image = enhance_image(image)

    # 3. Detect faces
    faces = detect_faces(image)

    # 4. Validate face count
    if faces is None or len(faces) == 0:
        logger.warning(
            "register-face: no face detected for student_id=%s", data.student_id
        )
        raise HTTPException(
            status_code=422,
            detail=(
                "No face was detected in the provided image. "
                "Please use a clear, well-lit photo with a single face."
            ),
        )

    if len(faces) > 1:
        logger.warning(
            "register-face: %d faces detected for student_id=%s (expected 1)",
            len(faces),
            data.student_id,
        )
        raise HTTPException(
            status_code=422,
            detail=(
                f"Exactly one face is required for registration, "
                f"but {len(faces)} faces were detected. "
                f"Please provide an individual portrait photo."
            ),
        )

    # 5. Extract 128-D embedding from the single detected face
    embedding_array: np.ndarray = get_single_embedding(image, faces[0])

    # Flatten from (1, 128) to (128,) if needed, then convert to Python list
    embedding: list[float] = embedding_array.flatten().tolist()

    logger.info(
        "register-face: embedding extracted successfully for student_id=%s " "(dim=%d)",
        data.student_id,
        len(embedding),
    )

    return RegisterFaceResponse(student_id=data.student_id, embedding=embedding)


# ---------------------------------------------------------------------------
# Recognition endpoint — hot path for every attendance session
# ---------------------------------------------------------------------------


@app.post("/recognize", response_model=RecognitionResponse, tags=["attendance"])
async def recognize_faces(data: AttendanceRequest) -> RecognitionResponse:
    """
    Identify which enrolled students are present in a classroom photo.

    This endpoint receives:
    - The classroom photo as a Base64-encoded string (decoded in memory — never
      written to disk or uploaded to any storage service).
    - A list of enrolled students with their pre-computed embeddings (loaded
      from the database by Node.js — no per-student downloads or inference).

    Recognition pipeline:
        1. Decode classroom image from Base64 in memory
        2. Preprocess the classroom image
        3. Detect all faces in the classroom image
        4. Extract 128-D embeddings for every detected face
        5. Build a (F × 128) class-face matrix once
        6. For each student, perform a single vectorized matrix multiplication
           to compute all cosine similarities simultaneously — no nested loops
        7. Return matched student IDs with the same response schema as before

    The outer Python loop over students remains (one iteration per student) but
    the inner comparison — previously O(S_i × F) Python iterations — is now a
    single NumPy BLAS call. Total complexity is O(students) Python calls, each
    doing O(S_i × F) arithmetic in compiled C.

    Raises:
        400: Classroom image could not be decoded
        503: AI models not yet initialized
    """
    logger.info(
        "recognize: processing attendance for %d enrolled student(s)",
        len(data.students),
    )

    # 1. Decode classroom image from Base64 in memory — zero disk I/O
    class_image = load_image_from_b64(data.class_image_b64)
    if class_image is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Could not decode the classroom image. Ensure the payload contains "
                "a valid Base64-encoded JPEG, PNG, or WebP image."
            ),
        )

    # 2. Preprocess classroom image
    class_image = enhance_image(class_image)

    # 3. Detect all faces in the classroom photo
    class_faces = detect_faces(class_image)

    if class_faces is None or len(class_faces) == 0:
        logger.info("recognize: no faces detected in classroom image")
        return RecognitionResponse(
            total_faces_detected=0,
            present_student_ids=[],
            absent_count=len(data.students),
        )

    # 4. Extract embeddings for all detected class faces
    class_embeddings_list = get_embeddings(class_image, class_faces)
    logger.info(
        "recognize: detected %d face(s) in classroom image",
        len(class_embeddings_list),
    )

    # 5. Build the (F, 128) class matrix ONCE — reused for every student
    class_matrix = build_class_matrix(class_embeddings_list)

    # 6. Vectorized matching — one matrix multiply per student, no inner loops
    present_student_ids: list[str] = []

    for student in data.students:
        is_present = match_student_vectorized(
            student.embeddings,
            class_matrix,
            threshold=SIMILARITY_THRESHOLD,
        )
        if is_present:
            logger.info("recognize: student %s → PRESENT", student.id)
            present_student_ids.append(student.id)
        else:
            logger.info("recognize: student %s → ABSENT", student.id)

    logger.info(
        "recognize: %d/%d students present",
        len(present_student_ids),
        len(data.students),
    )

    return RecognitionResponse(
        total_faces_detected=len(class_embeddings_list),
        present_student_ids=present_student_ids,
        absent_count=len(data.students) - len(present_student_ids),
    )
