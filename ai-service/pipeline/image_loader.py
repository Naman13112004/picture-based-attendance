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

import base64
import re

import cv2
import numpy as np
import requests

from config import IMAGE_DOWNLOAD_TIMEOUT

# Matches optional data URI prefix: data:image/jpeg;base64,<data>
_DATA_URI_RE = re.compile(r"^data:[^;]+;base64,", re.IGNORECASE)


def load_image_from_b64(b64_string: str) -> np.ndarray | None:
    """
    Decode a Base64-encoded image directly from memory into a BGR numpy array.

    Accepts both bare Base64 strings and full data URI strings
    (e.g. 'data:image/jpeg;base64,...').  No disk I/O is performed at any
    point — the raw bytes go straight from the string into OpenCV's imdecode.

    Args:
        b64_string: Base64 image string, with or without a data URI prefix.

    Returns:
        A BGR numpy array ready for OpenCV, or None on any failure.
    """
    try:
        # Strip data URI prefix if present
        raw_b64 = _DATA_URI_RE.sub("", b64_string.strip())

        # Pad to a valid Base64 length (multiple of 4)
        padding = 4 - len(raw_b64) % 4
        if padding != 4:
            raw_b64 += "=" * padding

        image_bytes = base64.b64decode(raw_b64)
        img_array = np.frombuffer(image_bytes, dtype=np.uint8)
        image = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

        if image is None:
            print("Failed to decode image from Base64: cv2.imdecode returned None")
            return None

        return image

    except Exception as e:
        print(f"Failed to decode Base64 image: {e}")
        return None


def load_image_from_url(url: str) -> np.ndarray | None:
    """
    Download an image from a URL and decode it into a BGR numpy array
    usable by OpenCV.

    Kept for backward compatibility and potential future use (e.g. admin
    tools, diagnostics). Not used in the primary attendance hot-path.

    Args:
        url: The full URL of the image to download.

    Returns:
        A numpy array (BGR format) of the image, or None if download/decode
        fails.
    """
    try:
        response = requests.get(url, timeout=IMAGE_DOWNLOAD_TIMEOUT)
        response.raise_for_status()

        img_array = np.frombuffer(response.content, dtype=np.uint8)
        image = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

        if image is None:
            print(f"Failed to decode image from {url}")
            return None

        return image

    except Exception as e:
        print(f"Failed to download or load image from {url}: {e}")
        return None
