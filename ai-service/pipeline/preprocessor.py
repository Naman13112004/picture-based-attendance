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
    UPSCALE_FACTOR,
)


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


def enhance_image(image: np.ndarray) -> np.ndarray:
    """
    Apply a sequence of image enhancements to improve face detection
    accuracy on challenging (blurred, low-light, low-res) images.

    Args:
        image: Original BGR numpy array.

    Returns:
        Enhanced BGR numpy array.
    """
    # 1. Upscale if the image is too small
    enhanced = _upscale_if_small(image)

    # 2. Improve local contrast if enabled
    if ENABLE_CLAHE:
        enhanced = _apply_clahe(enhanced)

    # 3. Sharpen blurred edges if enabled
    if ENABLE_SHARPEN:
        enhanced = _apply_sharpening(enhanced)

    return enhanced
