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
    return base64.b64encode(
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\x0bIDAT\x08\x99c\xf8\x0f\x04\x00\x09\xfb\x03\xfd\xe3U\xf2\x9c\x00\x00\x00\x00IEND\xaeB`\x82"
    ).decode("utf-8")


@patch("main.is_models_ready", return_value=True)
@patch("main.load_image_from_b64")
@patch("main.validate_image")
@patch("main.enhance_image")
@patch("main.detect_faces")
@patch("main.get_single_embedding")
def test_register_face_success(
    mock_get_single_embedding,
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
    mock_get_single_embedding.return_value = np.zeros((128,), dtype=np.float32)

    response = client.post(
        "/register-face",
        json={"student_id": "test-student-1", "image_b64": valid_b64_image},
    )

    assert response.status_code == 200
    assert response.json()["student_id"] == "test-student-1"
    assert len(response.json()["embedding"]) == 128


@patch("main.is_models_ready", return_value=True)
@patch("main.load_image_from_b64")
@patch("main.validate_image")
@patch("main.detect_faces")
def test_register_face_no_faces(
    mock_detect_faces,
    mock_validate_image,
    mock_load_image,
    mock_models_ready,
    client,
    valid_b64_image,
):
    mock_load_image.return_value = np.zeros((100, 100, 3), dtype=np.uint8)
    mock_validate_image.return_value = None
    mock_detect_faces.return_value = []  # no faces

    response = client.post(
        "/register-face",
        json={"student_id": "test-student-1", "image_b64": valid_b64_image},
    )

    assert response.status_code == 422
    assert "No face was detected" in response.json()["detail"]


@patch("main.is_models_ready", return_value=True)
@patch("main.load_image_from_b64")
@patch("main.validate_image")
@patch("main.detect_faces")
def test_register_face_multiple_faces(
    mock_detect_faces,
    mock_validate_image,
    mock_load_image,
    mock_models_ready,
    client,
    valid_b64_image,
):
    mock_load_image.return_value = np.zeros((100, 100, 3), dtype=np.uint8)
    mock_validate_image.return_value = None
    mock_detect_faces.return_value = [
        np.array([10, 10, 20, 20, 0.9]),
        np.array([30, 30, 40, 40, 0.8]),
    ]

    response = client.post(
        "/register-face",
        json={"student_id": "test-student-1", "image_b64": valid_b64_image},
    )

    assert response.status_code == 422
    assert "Exactly one face is required" in response.json()["detail"]


@patch("main.is_models_ready", return_value=True)
@patch("main.load_image_from_b64", return_value=None)
def test_register_face_invalid_image(mock_load_image, mock_models_ready, client):
    response = client.post(
        "/register-face", json={"student_id": "test-student-1", "image_b64": "invalid"}
    )
    assert response.status_code == 400
