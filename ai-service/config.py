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

# --- Model Configuration ---
MODEL_DIR = os.environ.get(
    "MODEL_DIR", os.path.join(os.path.dirname(__file__), "models")
)

# YuNet face detector (MIT License)
# Source: https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet
YUNET_MODEL_FILE = "face_detection_yunet_2023mar.onnx"
YUNET_MODEL_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/"
    "models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
)

# SFace face recognizer (Apache 2.0 License)
# Source: https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface
SFACE_MODEL_FILE = "face_recognition_sface_2021dec.onnx"
SFACE_MODEL_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/"
    "models/face_recognition_sface/face_recognition_sface_2021dec.onnx"
)

# --- Detection Configuration ---
# YuNet score threshold for face detection confidence
DETECTION_SCORE_THRESHOLD = float(os.environ.get("DETECTION_SCORE_THRESHOLD", "0.7"))
# Non-maximum suppression threshold to remove overlapping boxes
DETECTION_NMS_THRESHOLD = float(os.environ.get("DETECTION_NMS_THRESHOLD", "0.3"))
# Maximum number of faces to detect (0 = unlimited)
DETECTION_TOP_K = int(os.environ.get("DETECTION_TOP_K", "5000"))

# --- Recognition Configuration ---
# Cosine similarity threshold for face matching
# SFace recommended cosine distance threshold is 0.363
# Lower value = stricter matching (fewer false positives)
# Higher value = looser matching (fewer false negatives)
SIMILARITY_THRESHOLD = float(os.environ.get("SIMILARITY_THRESHOLD", "0.363"))

# --- Image Configuration ---
# Maximum image dimension (width or height) before downscaling for detection
MAX_IMAGE_DIMENSION = int(os.environ.get("MAX_IMAGE_DIMENSION", "2000"))
# Timeout in seconds for downloading images from URLs
IMAGE_DOWNLOAD_TIMEOUT = int(os.environ.get("IMAGE_DOWNLOAD_TIMEOUT", "15"))

# --- Preprocessing Configuration ---
# Toggle image enhancement features
ENABLE_CLAHE = os.environ.get("ENABLE_CLAHE", "true").lower() == "true"
ENABLE_SHARPEN = os.environ.get("ENABLE_SHARPEN", "true").lower() == "true"
# Minimum image dimension before upscaling is triggered
MIN_IMAGE_SIZE = int(os.environ.get("MIN_IMAGE_SIZE", "640"))
# Upscale factor when image is below MIN_IMAGE_SIZE
UPSCALE_FACTOR = float(os.environ.get("UPSCALE_FACTOR", "2.0"))

# --- Concurrency Configuration ---
# Max workers for concurrent student reference photo processing
MAX_WORKERS = int(os.environ.get("MAX_WORKERS", "4"))
