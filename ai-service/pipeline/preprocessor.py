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

import cv2
import numpy as np

from config import (
    ENABLE_CLAHE,
    ENABLE_SHARPEN,
    MIN_IMAGE_SIZE,
    MAX_IMAGE_DIMENSION,
    UPSCALE_FACTOR,
)

# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------

# Maximum allowed resolution (in megapixels) before we refuse to process.
# Prevents OOM attacks with pathological 100 MP images.
_MAX_MEGAPIXELS = 25.0


def validate_image(image: np.ndarray) -> str | None:
    """
    Validate a decoded image array before running expensive inference.

    Checks performed (Phase 6):
    - Image must have at least 2 dimensions (not a 1-D array).
    - Width and height must both be > 0.
    - Image must have 3 channels (BGR). Grayscale and RGBA are rejected.
    - Resolution must not exceed _MAX_MEGAPIXELS to prevent OOM attacks.

    Args:
        image: numpy array returned by load_image_from_b64().

    Returns:
        None if valid, or a human-readable error string if invalid.
    """
    if image is None or image.ndim < 2:
        return "Image array is empty or has fewer than 2 dimensions."

    h, w = image.shape[:2]

    if h == 0 or w == 0:
        return (
            f"Degenerate image dimensions: {w}×{h}. Width and height must both be > 0."
        )

    channels = image.shape[2] if image.ndim == 3 else 1
    if channels != 3:
        return (
            f"Image has {channels} channel(s); expected 3 (BGR). "
            "Grayscale and RGBA images are not supported — convert to RGB/JPEG first."
        )

    megapixels = (h * w) / 1_000_000
    if megapixels > _MAX_MEGAPIXELS:
        return (
            f"Image resolution ({w}×{h} = {megapixels:.1f} MP) exceeds the "
            f"{_MAX_MEGAPIXELS:.0f} MP limit. Please reduce the image size before uploading."
        )

    return None


# ---------------------------------------------------------------------------
# Enhancement helpers
# ---------------------------------------------------------------------------


def _apply_clahe(image: np.ndarray) -> np.ndarray:
    """
    Apply Contrast Limited Adaptive Histogram Equalization (CLAHE)
    to improve local contrast in poorly lit images.
    Operates on the L channel of the LAB color space.
    """
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    cl = clahe.apply(l)

    limg = cv2.merge((cl, a, b))
    return cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)


def _apply_sharpening(image: np.ndarray) -> np.ndarray:
    """
    Apply unsharp masking to enhance edge contrast and recover detail
    from slight blurs.
    """
    gaussian = cv2.GaussianBlur(image, (0, 0), 2.0)
    return cv2.addWeighted(image, 1.5, gaussian, -0.5, 0)


def _upscale_if_small(image: np.ndarray) -> np.ndarray:
    """
    Upscale the image if both dimensions are smaller than MIN_IMAGE_SIZE.
    Helps detect very small faces in low-resolution group photos.
    """
    h, w = image.shape[:2]
    if h < MIN_IMAGE_SIZE and w < MIN_IMAGE_SIZE:
        new_w = int(w * UPSCALE_FACTOR)
        new_h = int(h * UPSCALE_FACTOR)
        # Use cubic interpolation for better upscaling quality
        return cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
    return image


def _downscale_if_large(image: np.ndarray) -> np.ndarray:
    """
    Downscale the image if either dimension exceeds MAX_IMAGE_DIMENSION.

    Large images slow detection significantly and provide no benefit — YuNet
    detects faces at scales much smaller than the original resolution. Limiting
    the longer edge to MAX_IMAGE_DIMENSION (default: 2000 px) keeps inference
    fast while preserving enough detail for accurate detection.

    Phase 6: This was previously configured but never applied. Now enforced.
    """
    h, w = image.shape[:2]
    max_dim = max(h, w)
    if max_dim <= MAX_IMAGE_DIMENSION:
        return image

    scale = MAX_IMAGE_DIMENSION / max_dim
    new_w = int(w * scale)
    new_h = int(h * scale)
    return cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def enhance_image(image: np.ndarray) -> np.ndarray:
    """
    Apply a sequence of image enhancements to improve face detection
    accuracy on challenging (blurred, low-light, low-res) images.

    Pipeline (Phase 6 — now includes downscaling step):
        1. Downscale if larger than MAX_IMAGE_DIMENSION (was missing before)
        2. Upscale if both dimensions are below MIN_IMAGE_SIZE
        3. CLAHE contrast enhancement (if ENABLE_CLAHE)
        4. Unsharp masking / sharpening (if ENABLE_SHARPEN)

    Args:
        image: Original BGR numpy array.

    Returns:
        Enhanced BGR numpy array, ready for face detection.
    """
    # 0. Enforce upper size bound (Phase 6 fix — was configured but never applied)
    enhanced = _downscale_if_large(image)

    # 1. Upscale if the image is too small
    enhanced = _upscale_if_small(enhanced)

    # 2. Improve local contrast if enabled
    if ENABLE_CLAHE:
        enhanced = _apply_clahe(enhanced)

    # 3. Sharpen blurred edges if enabled
    if ENABLE_SHARPEN:
        enhanced = _apply_sharpening(enhanced)

    return enhanced
