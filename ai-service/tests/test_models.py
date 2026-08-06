import pytest
from pydantic import ValidationError
from models import RegisterFaceRequest, AttendanceRequest, ExtractEmbeddingsRequest


def test_register_face_request():
    req = RegisterFaceRequest(student_id="123", image_b64="base64str")
    assert req.student_id == "123"
    assert req.image_b64 == "base64str"


def test_register_face_invalid():
    with pytest.raises(ValidationError):
        RegisterFaceRequest(student_id="123")  # missing image_b64


def test_attendance_request():
    req = AttendanceRequest(
        class_image_b64="base64str", students=[{"id": "1", "embeddings": [[0.0] * 128]}]
    )
    assert len(req.students) == 1
    assert req.students[0].id == "1"


def test_extract_embeddings_request():
    req = ExtractEmbeddingsRequest(class_image_b64="base64str")
    assert req.class_image_b64 == "base64str"
