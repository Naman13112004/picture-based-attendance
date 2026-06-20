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

from pydantic import BaseModel
from typing import List


class Student(BaseModel):
    """A student with their reference face image URLs."""

    id: str
    image_paths: List[str]  # Full URLs: ["https://supa.../face1.jpg", ...]


class AttendanceRequest(BaseModel):
    """Request payload for the /recognize endpoint."""

    class_image_path: str  # Full URL: "https://supa.../class_101.jpg"
    students: List[Student]


class RecognitionResponse(BaseModel):
    """Response payload from the /recognize endpoint."""

    total_faces_detected: int
    present_student_ids: List[str]
    absent_count: int
