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
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from typing import Any

import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import SIMILARITY_THRESHOLD
from model_manager import (
    initialize_models,
    get_detector,
    get_recognizer,
    is_models_ready,
)
from models import (
    AttendanceRequest,
    RecognitionResponse,
    RegisterFaceRequest,
    RegisterFaceResponse,
    ExtractEmbeddingsRequest,
    ExtractEmbeddingsResponse,
)
from pipeline.detector import detect_faces
from pipeline.embedder import get_embeddings, get_single_embedding
from pipeline.image_loader import load_image_from_b64
from pipeline.matcher import build_class_matrix, match_student_vectorized
from pipeline.preprocessor import enhance_image, validate_image

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ai-service")

# ---------------------------------------------------------------------------
# In-process metrics (reset on restart — use Prometheus for production)
# ---------------------------------------------------------------------------

_metrics: dict[str, Any] = {
    "requests_total": defaultdict(int),  # endpoint → count
    "errors_total": defaultdict(int),  # endpoint → count
    "latency_ms_sum": defaultdict(float),  # endpoint → total ms
    "latency_ms_count": defaultdict(int),  # endpoint → sample count
    "faces_detected_total": 0,
    "started_at": time.time(),
}


def _record(endpoint: str, elapsed_ms: float, error: bool = False) -> None:
    _metrics["requests_total"][endpoint] += 1
    _metrics["latency_ms_sum"][endpoint] += elapsed_ms
    _metrics["latency_ms_count"][endpoint] += 1
    if error:
        _metrics["errors_total"][endpoint] += 1


# ---------------------------------------------------------------------------
# Lifespan (replaces deprecated @app.on_event("startup"))
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager — replaces the deprecated on_event("startup").

    On startup:
      - Downloads YuNet and SFace ONNX models if not cached locally.
      - Initialises the OpenCV DNN instances as module-level singletons.

    On shutdown:
      - Placeholder for graceful cleanup (connection pools, temp files, etc.).
    """
    logger.info("AI service starting up — initialising face recognition pipeline...")
    initialize_models()
    logger.info("Pipeline ready. Models loaded and warmed up.")
    yield
    logger.info("AI service shutting down.")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="SnapAttend AI Service",
    description=(
        "Face detection and recognition pipeline for picture-based attendance. "
        "Provides pre-computation of student embeddings at registration time and "
        "fully vectorized matching at attendance time."
    ),
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Correlation ID middleware
# ---------------------------------------------------------------------------


@app.middleware("http")
async def correlation_middleware(request: Request, call_next):
    """
    Forward or generate a correlation ID for every request.
    The ID is added to all log lines and echoed in the response header
    so Node.js workers can correlate their BullMQ job logs with AI service logs.
    """
    correlation_id = (
        request.headers.get("x-correlation-id")
        or request.headers.get("x-request-id")
        or f"ai-{int(time.time() * 1000)}"
    )
    # Attach to request state so endpoint handlers can read it
    request.state.correlation_id = correlation_id

    response = await call_next(request)
    response.headers["X-Correlation-Id"] = correlation_id
    return response


# ---------------------------------------------------------------------------
# Helper: extract correlation ID from request state
# ---------------------------------------------------------------------------


def _cid(request: Request) -> str:
    return getattr(request.state, "correlation_id", "-")


# ---------------------------------------------------------------------------
# Health / readiness
# ---------------------------------------------------------------------------


@app.get("/", tags=["health"])
def read_root() -> dict:
    """Basic liveness check — always returns 200 if the process is running."""
    return {"status": "AI Service is Running", "version": "3.0.0"}


@app.get("/ready", tags=["health"])
def readiness_probe() -> JSONResponse:
    """
    Readiness probe — returns 200 only after models are fully initialised.
    Returns 503 during cold start / model download.

    Load balancers and Docker healthchecks should use this endpoint,
    NOT the liveness `/` endpoint, so no traffic is routed until the
    pipeline is actually ready to serve requests.
    """
    if not is_models_ready():
        return JSONResponse(
            status_code=503,
            content={
                "status": "not_ready",
                "detail": "Models are not yet initialised.",
            },
        )
    return JSONResponse(
        status_code=200,
        content={"status": "ready", "version": "3.0.0"},
    )


@app.get("/metrics", tags=["observability"])
def get_metrics() -> dict:
    """
    Lightweight in-process metrics endpoint.
    Returns request counts, error rates, and mean latency per endpoint.
    Resets on process restart — use Prometheus/Grafana for persistent metrics.
    """
    summary: dict[str, Any] = {
        "uptime_seconds": round(time.time() - _metrics["started_at"], 1),
        "faces_detected_total": _metrics["faces_detected_total"],
        "endpoints": {},
    }
    endpoints: set[str] = set(_metrics["requests_total"].keys())
    for ep in endpoints:
        total = _metrics["requests_total"][ep]
        errors = _metrics["errors_total"][ep]
        lat_sum = _metrics["latency_ms_sum"][ep]
        lat_cnt = _metrics["latency_ms_count"][ep]
        summary["endpoints"][ep] = {
            "requests_total": total,
            "errors_total": errors,
            "mean_latency_ms": round(lat_sum / lat_cnt, 1) if lat_cnt > 0 else 0.0,
        }
    return summary


# ---------------------------------------------------------------------------
# Registration endpoint
# ---------------------------------------------------------------------------


@app.post("/register-face", response_model=RegisterFaceResponse, tags=["registration"])
async def register_face(
    data: RegisterFaceRequest, request: Request
) -> RegisterFaceResponse:
    """
    Extract and return the SFace embedding for a single student reference photo.

    Phase 6 additions:
    - Per-request timing (decode, preprocess, detect, embed) returned in logs.
    - Correlation ID forwarded through all log lines.
    - Input validation before expensive processing.

    Raises:
        400: Image could not be decoded or fails validation.
        422: Zero faces detected, or more than one face detected.
        503: AI models not yet initialized.
    """
    cid = _cid(request)
    t0 = time.perf_counter()

    logger.info("[%s] register-face: student_id=%s", cid, data.student_id)

    if not is_models_ready():
        _record("register-face", 0, error=True)
        raise HTTPException(
            status_code=503, detail="Models not yet initialised. Retry in a moment."
        )

    # 1. Decode
    t_decode = time.perf_counter()
    image = load_image_from_b64(data.image_b64)
    if image is None:
        _record("register-face", (time.perf_counter() - t0) * 1000, error=True)
        raise HTTPException(
            status_code=400,
            detail=(
                "Could not decode image. Ensure the payload is a valid Base64-encoded "
                "JPEG, PNG, or WebP image, with or without a data URI prefix."
            ),
        )

    # 1b. Validate image dimensions
    validation_error = validate_image(image)
    if validation_error:
        _record("register-face", (time.perf_counter() - t0) * 1000, error=True)
        raise HTTPException(status_code=400, detail=validation_error)

    decode_ms = (time.perf_counter() - t_decode) * 1000

    # 2. Preprocess
    t_preprocess = time.perf_counter()
    image = enhance_image(image)
    preprocess_ms = (time.perf_counter() - t_preprocess) * 1000

    # 3. Detect
    t_detect = time.perf_counter()
    faces = detect_faces(image)
    detect_ms = (time.perf_counter() - t_detect) * 1000

    if faces is None or len(faces) == 0:
        logger.warning(
            "[%s] register-face: no face detected for student_id=%s",
            cid,
            data.student_id,
        )
        _record("register-face", (time.perf_counter() - t0) * 1000, error=True)
        raise HTTPException(
            status_code=422,
            detail=(
                "No face was detected in the provided image. "
                "Please use a clear, well-lit photo with a single face."
            ),
        )

    if len(faces) > 1:
        logger.warning(
            "[%s] register-face: %d faces detected for student_id=%s (expected 1)",
            cid,
            len(faces),
            data.student_id,
        )
        _record("register-face", (time.perf_counter() - t0) * 1000, error=True)
        raise HTTPException(
            status_code=422,
            detail=(
                f"Exactly one face is required for registration, "
                f"but {len(faces)} faces were detected. "
                f"Please provide an individual portrait photo."
            ),
        )

    # 4. Embed
    t_embed = time.perf_counter()
    embedding_array: np.ndarray = get_single_embedding(image, faces[0])
    embed_ms = (time.perf_counter() - t_embed) * 1000

    embedding: list[float] = embedding_array.flatten().tolist()
    total_ms = (time.perf_counter() - t0) * 1000

    logger.info(
        "[%s] register-face: student_id=%s | dim=%d | "
        "decode=%.1fms preprocess=%.1fms detect=%.1fms embed=%.1fms total=%.1fms",
        cid,
        data.student_id,
        len(embedding),
        decode_ms,
        preprocess_ms,
        detect_ms,
        embed_ms,
        total_ms,
    )

    _record("register-face", total_ms)
    _metrics["faces_detected_total"] += 1

    return RegisterFaceResponse(student_id=data.student_id, embedding=embedding)


# ---------------------------------------------------------------------------
# Recognition endpoint (legacy — still supported)
# ---------------------------------------------------------------------------


@app.post("/recognize", response_model=RecognitionResponse, tags=["attendance"])
async def recognize_faces(
    data: AttendanceRequest, request: Request
) -> RecognitionResponse:
    """
    Identify which enrolled students are present in a classroom photo.

    Phase 6 additions:
    - Per-request timing per stage returned in logs.
    - Correlation ID propagated.
    - Input validation before heavy processing.
    - Readiness guard.

    Note: The /extract-embeddings endpoint (Phase 5 pgvector path) is preferred.
    This endpoint is kept for backward compatibility and manual testing.

    Raises:
        400: Classroom image could not be decoded.
        503: AI models not yet initialized.
    """
    cid = _cid(request)
    t0 = time.perf_counter()

    logger.info(
        "[%s] recognize: processing %d enrolled student(s)",
        cid,
        len(data.students),
    )

    if not is_models_ready():
        _record("recognize", 0, error=True)
        raise HTTPException(
            status_code=503, detail="Models not yet initialised. Retry in a moment."
        )

    # 1. Decode + validate
    t_decode = time.perf_counter()
    class_image = load_image_from_b64(data.class_image_b64)
    if class_image is None:
        _record("recognize", (time.perf_counter() - t0) * 1000, error=True)
        raise HTTPException(
            status_code=400,
            detail=(
                "Could not decode the classroom image. Ensure the payload contains "
                "a valid Base64-encoded JPEG, PNG, or WebP image."
            ),
        )

    validation_error = validate_image(class_image)
    if validation_error:
        _record("recognize", (time.perf_counter() - t0) * 1000, error=True)
        raise HTTPException(status_code=400, detail=validation_error)

    decode_ms = (time.perf_counter() - t_decode) * 1000

    # 2. Preprocess
    t_preprocess = time.perf_counter()
    class_image = enhance_image(class_image)
    preprocess_ms = (time.perf_counter() - t_preprocess) * 1000

    # 3. Detect
    t_detect = time.perf_counter()
    class_faces = detect_faces(class_image)
    detect_ms = (time.perf_counter() - t_detect) * 1000

    if class_faces is None or len(class_faces) == 0:
        logger.info("[%s] recognize: no faces detected", cid)
        _record("recognize", (time.perf_counter() - t0) * 1000)
        return RecognitionResponse(
            total_faces_detected=0,
            present_student_ids=[],
            absent_count=len(data.students),
        )

    # 4. Embed all faces
    t_embed = time.perf_counter()
    class_embeddings_list = get_embeddings(class_image, class_faces)
    embed_ms = (time.perf_counter() - t_embed) * 1000

    # 5. Build class matrix once
    class_matrix = build_class_matrix(class_embeddings_list)

    # 6. Vectorized matching
    t_match = time.perf_counter()
    present_student_ids: list[str] = []
    for student in data.students:
        is_present = match_student_vectorized(
            student.embeddings,
            class_matrix,
            threshold=SIMILARITY_THRESHOLD,
        )
        if is_present:
            present_student_ids.append(student.id)

    match_ms = (time.perf_counter() - t_match) * 1000
    total_ms = (time.perf_counter() - t0) * 1000

    logger.info(
        "[%s] recognize: %d/%d present | faces=%d | "
        "decode=%.1fms preprocess=%.1fms detect=%.1fms embed=%.1fms match=%.1fms total=%.1fms",
        cid,
        len(present_student_ids),
        len(data.students),
        len(class_embeddings_list),
        decode_ms,
        preprocess_ms,
        detect_ms,
        embed_ms,
        match_ms,
        total_ms,
    )

    _record("recognize", total_ms)
    _metrics["faces_detected_total"] += len(class_embeddings_list)

    return RecognitionResponse(
        total_faces_detected=len(class_embeddings_list),
        present_student_ids=present_student_ids,
        absent_count=len(data.students) - len(present_student_ids),
    )


# ---------------------------------------------------------------------------
# Embedding extraction endpoint (Phase 5 pgvector path)
# ---------------------------------------------------------------------------


@app.post(
    "/extract-embeddings", response_model=ExtractEmbeddingsResponse, tags=["attendance"]
)
async def extract_embeddings(
    data: ExtractEmbeddingsRequest, request: Request
) -> ExtractEmbeddingsResponse:
    """
    Detect all faces in a classroom photo and return their 128-D embeddings.

    Phase 6 additions:
    - Per-request timing in logs.
    - Correlation ID forwarded.
    - Input validation before processing.
    - Readiness guard.

    Pipeline:
        1. Decode classroom image from Base64 in memory
        2. Validate dimensions
        3. Preprocess image (CLAHE, sharpening)
        4. Detect all faces with YuNet
        5. Extract 128-D L2-normalised SFace embedding per face
        6. Return embeddings as nested float lists

    Raises:
        400: Classroom image could not be decoded or fails validation.
        503: AI models not yet initialized.
    """
    cid = _cid(request)
    t0 = time.perf_counter()

    logger.info("[%s] extract-embeddings: processing classroom image", cid)

    if not is_models_ready():
        _record("extract-embeddings", 0, error=True)
        raise HTTPException(
            status_code=503, detail="Models not yet initialised. Retry in a moment."
        )

    # 1. Decode
    t_decode = time.perf_counter()
    class_image = load_image_from_b64(data.class_image_b64)
    if class_image is None:
        _record("extract-embeddings", (time.perf_counter() - t0) * 1000, error=True)
        raise HTTPException(
            status_code=400,
            detail=(
                "Could not decode the classroom image. Ensure the payload contains "
                "a valid Base64-encoded JPEG, PNG, or WebP image."
            ),
        )

    # 1b. Validate
    validation_error = validate_image(class_image)
    if validation_error:
        _record("extract-embeddings", (time.perf_counter() - t0) * 1000, error=True)
        raise HTTPException(status_code=400, detail=validation_error)

    decode_ms = (time.perf_counter() - t_decode) * 1000

    # 2. Preprocess
    t_preprocess = time.perf_counter()
    class_image = enhance_image(class_image)
    preprocess_ms = (time.perf_counter() - t_preprocess) * 1000

    # 3. Detect
    t_detect = time.perf_counter()
    class_faces = detect_faces(class_image)
    detect_ms = (time.perf_counter() - t_detect) * 1000

    if class_faces is None or len(class_faces) == 0:
        logger.info("[%s] extract-embeddings: no faces detected", cid)
        _record("extract-embeddings", (time.perf_counter() - t0) * 1000)
        return ExtractEmbeddingsResponse(face_count=0, embeddings=[])

    # 4. Embed
    t_embed = time.perf_counter()
    class_embeddings_list = get_embeddings(class_image, class_faces)
    embed_ms = (time.perf_counter() - t_embed) * 1000

    total_ms = (time.perf_counter() - t0) * 1000

    logger.info(
        "[%s] extract-embeddings: %d face(s) | "
        "decode=%.1fms preprocess=%.1fms detect=%.1fms embed=%.1fms total=%.1fms",
        cid,
        len(class_embeddings_list),
        decode_ms,
        preprocess_ms,
        detect_ms,
        embed_ms,
        total_ms,
    )

    _record("extract-embeddings", total_ms)
    _metrics["faces_detected_total"] += len(class_embeddings_list)

    embeddings_out: list[list[float]] = [
        emb.flatten().tolist() for emb in class_embeddings_list
    ]

    return ExtractEmbeddingsResponse(
        face_count=len(embeddings_out),
        embeddings=embeddings_out,
    )
