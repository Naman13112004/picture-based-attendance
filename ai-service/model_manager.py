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

import os
import cv2
import requests

from config import (
    MODEL_DIR,
    YUNET_MODEL_FILE,
    YUNET_MODEL_URL,
    SFACE_MODEL_FILE,
    SFACE_MODEL_URL,
    DETECTION_SCORE_THRESHOLD,
    DETECTION_NMS_THRESHOLD,
    DETECTION_TOP_K,
)

# Module-level singletons for the OpenCV DNN model instances
_detector: cv2.FaceDetectorYN = None  # type: ignore[assignment]
_recognizer: cv2.FaceRecognizerSF = None  # type: ignore[assignment]


def _download_model(url: str, dest_path: str) -> None:
    """Download a model file from a URL if it doesn't already exist."""
    if os.path.exists(dest_path):
        print(f"Model already cached: {dest_path}")
        return

    print(f"Downloading model: {url} -> {dest_path}")
    response = requests.get(url, stream=True, timeout=120)
    response.raise_for_status()

    # Write in chunks to handle large files
    with open(dest_path, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)

    file_size_mb = os.path.getsize(dest_path) / (1024 * 1024)
    print(f"Downloaded: {dest_path} ({file_size_mb:.1f} MB)")


def _ensure_models_downloaded() -> tuple[str, str]:
    """Ensure both model files are downloaded and return their paths."""
    os.makedirs(MODEL_DIR, exist_ok=True)

    yunet_path = os.path.join(MODEL_DIR, YUNET_MODEL_FILE)
    sface_path = os.path.join(MODEL_DIR, SFACE_MODEL_FILE)

    _download_model(YUNET_MODEL_URL, yunet_path)
    _download_model(SFACE_MODEL_URL, sface_path)

    return yunet_path, sface_path


def initialize_models() -> None:
    """
    Download models (if needed) and create the OpenCV DNN instances.
    Called once at application startup.
    """
    global _detector, _recognizer

    yunet_path, sface_path = _ensure_models_downloaded()

    # Create YuNet face detector
    # Initial input size is (320, 320); it gets updated dynamically per image
    _detector = cv2.FaceDetectorYN.create(
        model=yunet_path,
        config="",
        input_size=(320, 320),
        score_threshold=DETECTION_SCORE_THRESHOLD,
        nms_threshold=DETECTION_NMS_THRESHOLD,
        top_k=DETECTION_TOP_K,
    )

    # Create SFace face recognizer
    _recognizer = cv2.FaceRecognizerSF.create(
        model=sface_path,
        config="",
    )

    print("Face detection (YuNet) and recognition (SFace) models loaded.")


def get_detector() -> cv2.FaceDetectorYN:
    """Get the initialized YuNet face detector instance."""
    if _detector is None:
        raise RuntimeError("Models not initialized. Call initialize_models() first.")
    return _detector


def get_recognizer() -> cv2.FaceRecognizerSF:
    """Get the initialized SFace face recognizer instance."""
    if _recognizer is None:
        raise RuntimeError("Models not initialized. Call initialize_models() first.")
    return _recognizer
