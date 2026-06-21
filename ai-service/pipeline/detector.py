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

from model_manager import get_detector
from config import MAX_IMAGE_DIMENSION


def _clamp_image_size(image: np.ndarray) -> tuple[np.ndarray, float]:
    """
    Downscale image if either dimension exceeds MAX_IMAGE_DIMENSION,
    preserving aspect ratio. Large images slow detection without
    improving accuracy beyond a point.
    Returns the (image, scale_factor).
    """
    h, w = image.shape[:2]
    max_dim = max(h, w)

    if max_dim <= MAX_IMAGE_DIMENSION:
        return image, 1.0

    scale = MAX_IMAGE_DIMENSION / max_dim
    new_w = int(w * scale)
    new_h = int(h * scale)
    return cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA), scale


def detect_faces(image: np.ndarray) -> np.ndarray | None:
    """
    Detect all faces in an image using YuNet.

    The detector's input size is set dynamically to match the image
    dimensions for best accuracy at the image's native resolution.

    Args:
        image: BGR numpy array of the image.

    Returns:
        An Nx15 numpy array where each row represents a detected face:
            [x, y, w, h,                          # bounding box
             x_re, y_re, x_le, y_le,              # right eye, left eye
             x_nose, y_nose,                       # nose tip
             x_rmouth, y_rmouth, x_lmouth, y_lmouth,  # mouth corners
             confidence]                           # detection score
        Returns None if no faces are detected.
    """
    # Clamp large images to prevent excessive memory usage
    clamped_image, scale = _clamp_image_size(image)

    detector = get_detector()

    # Set detector input size to match this specific image
    h, w = clamped_image.shape[:2]
    detector.setInputSize((w, h))

    # Run detection
    retval, faces = detector.detect(clamped_image)

    if faces is None or len(faces) == 0:
        return None

    # If the image was downscaled, scale the coordinates back to original image size
    # Columns 0-13 are spatial coordinates (x,y,w,h, and 5 landmarks). Column 14 is confidence.
    if scale != 1.0:
        faces[:, :14] = faces[:, :14] / scale

    return faces
