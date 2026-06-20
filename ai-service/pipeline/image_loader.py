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
import requests

from config import IMAGE_DOWNLOAD_TIMEOUT


def load_image_from_url(url: str) -> np.ndarray | None:
    """
    Download an image from a URL and decode it into a BGR numpy array
    usable by OpenCV.

    Args:
        url: The full URL of the image to download.

    Returns:
        A numpy array (BGR format) of the image, or None if download/decode
        fails.
    """
    try:
        response = requests.get(url, timeout=IMAGE_DOWNLOAD_TIMEOUT)
        response.raise_for_status()

        # Decode image bytes directly into a numpy array via OpenCV
        img_array = np.frombuffer(response.content, dtype=np.uint8)
        image = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

        if image is None:
            print(f"Failed to decode image from {url}")
            return None

        return image

    except Exception as e:
        print(f"Failed to download or load image from {url}: {e}")
        return None
