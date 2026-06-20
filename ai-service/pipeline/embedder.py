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

import numpy as np

from model_manager import get_recognizer


def get_embeddings(image: np.ndarray, faces: np.ndarray) -> list[np.ndarray]:
    """
    Extract 128-D face embeddings for all detected faces in an image.

    For each face, SFace performs:
      1. alignCrop — affine-warps the face region to a canonical 112x112
         pose using the 5 facial landmarks (eyes, nose, mouth corners).
      2. feature — runs the aligned face through the MobileFaceNet backbone
         to produce a normalized 128-dimensional embedding vector.

    Args:
        image: BGR numpy array of the original image.
        faces: Nx15 detection matrix from YuNet (see detector.py).

    Returns:
        A list of 128-D numpy arrays, one per detected face.
    """
    recognizer = get_recognizer()
    embeddings = []

    for face in faces:
        # Align and crop the face to 112x112 using the 5-point landmarks
        aligned = recognizer.alignCrop(image, face)

        # Extract the 128-D normalized embedding
        embedding = recognizer.feature(aligned)

        embeddings.append(embedding)

    return embeddings


def get_single_embedding(image: np.ndarray, face: np.ndarray) -> np.ndarray:
    """
    Extract a single 128-D embedding for one detected face.

    Convenience wrapper for processing student reference photos where
    typically only one face is expected.

    Args:
        image: BGR numpy array of the image.
        face: A single face row (1x15) from YuNet detection.

    Returns:
        A 128-D numpy array embedding.
    """
    recognizer = get_recognizer()
    aligned = recognizer.alignCrop(image, face)
    return recognizer.feature(aligned)
