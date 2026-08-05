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
def test_extract_embeddings_success(
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
    mock_detect_faces.return_value = [
        np.array([10, 10, 20, 20, 0.9]),
        np.array([30, 30, 40, 40, 0.8]),
    ]
    mock_get_embeddings.return_value = [
        np.zeros((128,), dtype=np.float32),
        np.ones((128,), dtype=np.float32),
    ]

    response = client.post(
        "/extract-embeddings", json={"class_image_b64": valid_b64_image}
    )

    assert response.status_code == 200
    assert response.json()["face_count"] == 2
    assert len(response.json()["embeddings"]) == 2
    assert len(response.json()["embeddings"][0]) == 128


@patch("main.is_models_ready", return_value=True)
@patch("main.load_image_from_b64")
@patch("main.validate_image")
@patch("main.detect_faces")
def test_extract_embeddings_no_faces(
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

    response = client.post(
        "/extract-embeddings", json={"class_image_b64": valid_b64_image}
    )

    assert response.status_code == 200
    assert response.json()["face_count"] == 0
    assert len(response.json()["embeddings"]) == 0
