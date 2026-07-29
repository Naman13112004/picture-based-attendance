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

from pydantic import BaseModel, field_validator
from typing import List

# ---------------------------------------------------------------------------
# Registration models
# ---------------------------------------------------------------------------


class RegisterFaceRequest(BaseModel):
    """
    Request payload for POST /register-face.

    Accepts a Base64-encoded image (with or without the data URI prefix,
    e.g. 'data:image/jpeg;base64,...') and the student's unique ID.
    """

    image_b64: str
    student_id: str

    @field_validator("image_b64")
    @classmethod
    def must_not_be_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("image_b64 must not be empty")
        return v.strip()

    @field_validator("student_id")
    @classmethod
    def student_id_must_not_be_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("student_id must not be empty")
        return v.strip()


class RegisterFaceResponse(BaseModel):
    """
    Response payload from POST /register-face.

    Returns the L2-normalized 128-D SFace embedding as a flat float list.
    The Node.js backend persists this in PostgreSQL as a JSON array.
    """

    student_id: str
    embedding: List[float]


# ---------------------------------------------------------------------------
# Attendance recognition models
# ---------------------------------------------------------------------------


class StudentEmbeddings(BaseModel):
    """
    A student identified by their pre-computed face embeddings.

    Replaces the old Student model (which carried image URLs). Embeddings
    are loaded from the database — no inference happens per-student at
    recognition time.

    embeddings: List of up to 3 pre-computed L2-normalized 128-D SFace
                vectors, one per reference photo registered by the student.
    """

    id: str
    embeddings: List[List[float]]

    @field_validator("embeddings")
    @classmethod
    def embeddings_must_not_be_empty(cls, v: List[List[float]]) -> List[List[float]]:
        if not v:
            raise ValueError("embeddings list must contain at least one vector")
        for vec in v:
            if len(vec) != 128:
                raise ValueError(
                    f"Each embedding must be 128-dimensional, got {len(vec)}"
                )
        return v


class AttendanceRequest(BaseModel):
    """
    Request payload for POST /recognize.

    class_image_b64: Base64-encoded classroom photo (with or without data
                     URI prefix). Decoded in memory — never written to disk.
    students:        List of enrolled students with their pre-computed
                     embeddings. No per-student downloads or inference.
    """

    class_image_b64: str
    students: List[StudentEmbeddings]

    @field_validator("class_image_b64")
    @classmethod
    def image_must_not_be_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("class_image_b64 must not be empty")
        return v.strip()


class RecognitionResponse(BaseModel):
    """Response payload from POST /recognize."""

    total_faces_detected: int
    present_student_ids: List[str]
    absent_count: int
