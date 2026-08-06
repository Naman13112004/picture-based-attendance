import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
from main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def mock_models_ready():
    with patch("main.is_models_ready", return_value=True) as m:
        yield m


def test_health_check(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "AI Service is Running"


def test_readiness_probe_not_ready(client):
    with patch("main.is_models_ready", return_value=False):
        response = client.get("/ready")
        assert response.status_code == 503


def test_readiness_probe_ready(client, mock_models_ready):
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"
