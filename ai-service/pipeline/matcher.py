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

from model_manager import get_recognizer
from config import SIMILARITY_THRESHOLD


def match_student(
    student_embeddings: list[np.ndarray],
    class_embeddings: list[np.ndarray],
    threshold: float = SIMILARITY_THRESHOLD,
) -> bool:
    """
    Determine if a student is present in the class photo by comparing
    their reference embeddings against all detected class face embeddings.

    Uses cosine similarity via SFace's built-in match() method.
    A student is considered present if ANY of their reference embeddings
    matches ANY class face embedding above the threshold.

    Args:
        student_embeddings: List of 128-D embeddings from the student's
            reference photos.
        class_embeddings: List of 128-D embeddings from all faces detected
            in the class photo.
        threshold: Cosine similarity threshold. A pair is considered a
            match if the score >= threshold. Default from config.

    Returns:
        True if the student is found in the class photo, False otherwise.
    """
    if not student_embeddings or not class_embeddings:
        return False

    recognizer = get_recognizer()

    for student_emb in student_embeddings:
        for class_emb in class_embeddings:
            # FR_COSINE returns a cosine similarity score
            # Higher score = more similar faces
            score = recognizer.match(
                student_emb,
                class_emb,
                cv2.FaceRecognizerSF_FR_COSINE,
            )

            if score >= threshold:
                return True

    return False
