import base64
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
import numpy as np
from main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def valid_b64_image():
    return base64.b64encode(b"mock_image").decode("utf-8")


@patch("main.is_models_ready", return_value=True)
@patch("main.load_image_from_b64")
@patch("main.validate_image")
@patch("main.enhance_image")
@patch("main.detect_faces")
@patch("main.get_embeddings")
@patch("main.match_student_vectorized")
def test_recognize_success(
    mock_match_student,
    mock_get_embeddings,
    mock_detect_faces,
    mock_enhance_image,
    mock_validate_image,
    mock_load_image,
    mock_models_ready,
    client,
    valid_b64_image,
):
    mock_load_image.return_value = np.zeros((100, 100, 3), dtype=np.uint8)
    mock_validate_image.return_value = None
    mock_detect_faces.return_value = [np.array([10, 10, 20, 20, 0.9])]
    mock_get_embeddings.return_value = [np.zeros((128,), dtype=np.float32)]
    mock_match_student.return_value = True

    payload = {
        "class_image_b64": valid_b64_image,
        "students": [{"id": "student-1", "embeddings": [[0.0] * 128]}],
    }

    response = client.post("/recognize", json=payload)

    assert response.status_code == 200
    assert response.json()["total_faces_detected"] == 1
    assert "student-1" in response.json()["present_student_ids"]


@patch("main.is_models_ready", return_value=True)
@patch("main.load_image_from_b64")
@patch("main.validate_image")
@patch("main.detect_faces")
def test_recognize_no_faces(
    mock_detect_faces,
    mock_validate_image,
    mock_load_image,
    mock_models_ready,
    client,
    valid_b64_image,
):
    mock_load_image.return_value = np.zeros((100, 100, 3), dtype=np.uint8)
    mock_validate_image.return_value = None
    mock_detect_faces.return_value = []

    payload = {
        "class_image_b64": valid_b64_image,
        "students": [{"id": "student-1", "embeddings": [[0.0] * 128]}],
    }

    response = client.post("/recognize", json=payload)

    assert response.status_code == 200
    assert response.json()["total_faces_detected"] == 0
    assert len(response.json()["present_student_ids"]) == 0


@patch("main.is_models_ready", return_value=True)
def test_recognize_empty_students(mock_models_ready, client, valid_b64_image):
    payload = {"class_image_b64": valid_b64_image, "students": []}
    response = client.post("/recognize", json=payload)
    assert response.status_code == 400
