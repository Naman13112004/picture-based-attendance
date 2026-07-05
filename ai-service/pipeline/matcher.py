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

from config import SIMILARITY_THRESHOLD


def match_student_vectorized(
    student_embeddings: list[list[float]],
    class_matrix: np.ndarray,
    threshold: float = SIMILARITY_THRESHOLD,
) -> bool:
    """
    Determine if a student is present in the class photo using fully
    vectorized NumPy matrix operations — no Python loops over individual
    embedding pairs.

    Both student embeddings and class embeddings are expected to be
    L2-normalized (unit norm vectors).  For unit vectors, cosine similarity
    equals the dot product, so a single matrix multiplication yields the
    complete (S_i × F) similarity matrix for a student with S_i reference
    embeddings against F detected class faces.

    Complexity: O(S_i × F) — but executed as a single BLAS kernel call,
    orders of magnitude faster than equivalent nested Python loops.

    Args:
        student_embeddings: List of S_i pre-computed L2-normalized 128-D
            embedding vectors loaded from the database. Each inner list has
            exactly 128 floats.
        class_matrix: Float32 numpy array of shape (F, 128) — the
            L2-normalized embeddings of all faces detected in the class
            photo.  Pre-computed once per attendance request and reused
            across all students.
        threshold: Cosine similarity threshold. A student is considered
            present if ANY of their reference embeddings matches ANY class
            face above this value.

    Returns:
        True if the student is present, False otherwise.
    """
    if not student_embeddings or class_matrix.size == 0:
        return False

    # Build student matrix from pre-computed embeddings — no inference here
    # Shape: (S_i, 128)  where S_i = number of reference photos (1–3)
    s_matrix = np.array(student_embeddings, dtype=np.float32)

    # Both matrices are L2-normalized → cosine similarity = dot product
    # Result shape: (S_i, F)  — every reference embedding vs every class face
    similarities = s_matrix @ class_matrix.T

    # Present if ANY reference embedding matches ANY class face
    return bool(np.any(similarities >= threshold))


def build_class_matrix(class_embeddings: list[np.ndarray]) -> np.ndarray:
    """
    Stack all per-face embeddings from the class photo into a single
    (F, 128) float32 matrix.

    Pre-computing this matrix once and reusing it across all student
    comparisons avoids repeated array allocation and normalization.

    Args:
        class_embeddings: List of F numpy arrays, each of shape (1, 128)
            or (128,) as returned by SFace recognizer.feature().

    Returns:
        A (F, 128) float32 numpy array ready for matrix multiplication.
        Returns an empty (0, 128) array if the list is empty.
    """
    if not class_embeddings:
        return np.empty((0, 128), dtype=np.float32)

    # Flatten any (1, 128) shapes to (128,) before stacking
    flat = [emb.flatten() for emb in class_embeddings]
    return np.array(flat, dtype=np.float32)
