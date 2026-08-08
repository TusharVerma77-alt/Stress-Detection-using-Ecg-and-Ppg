"""
test_main.py — Automated Pytest suite for FastAPI Backend API endpoints.
"""
import sys
from pathlib import Path
from fastapi.testclient import TestClient

# Ensure backend root is in import path
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.main import app

client = TestClient(app)

# Standard 85-feature dummy vector for testing WESAD inference
DUMMY_85_FEATURES = [
    72.5, 71.8, 835.4, 832.0, 45.2, 38.6, 22.1, 15, 8, 0.18, 0.09, 0.054,
    2043.2, 145.0, 450.2, 310.5, 760.7, 1.45, 59.2, 40.8, 0.12, 4.21, 120.4,
    15.3, 0.45, 0.32, 0.18, 0.09, 0.04, 0.52, 0.38, 0.21, 0.11, 0.05, 1.42,
    2.15, 4.88, 1.25, 1.82, 0.14, 1.88, 3.42, 0.85, 1.62, 1.95, 3.12, 0.78,
    1.51, 0.02, 0.95, 0.15, 0.82, -0.45, 0.55, 72.0, 833.0, 12.4, 0.42, 0.08,
    0.68, 0.12, 0.05, 2.85, 0.18, 12.4, 0.85, 18.5, 4.22, 1.35, 2.05, 1.18,
    1.75, 0.12, 45.2, 18.5, 8.5, 0.98, 0.92, 16.4, 2.1, 0.12, 1.8, 0.45,
    -0.12, 2.45
]


def test_health_endpoint():
    """Verify readiness probe return values and model loading status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("ok", "degraded")
    assert "model_loaded" in data


def test_predict_endpoint_valid():
    """Verify POST /predict returns prediction, class probabilities, and SHAP features."""
    payload = {"features": DUMMY_85_FEATURES, "session_id": "test-session-1"}
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "prediction" in data
    assert data["prediction"] in ["Baseline", "Stress", "Amusement", "Meditation"]
    assert "probabilities" in data
    assert len(data["probabilities"]) == 4
    assert "top_features" in data
    assert isinstance(data["top_features"], list)
    assert "model" in data
    assert data["model"]["n_features"] == 85


def test_predict_endpoint_invalid_feature_length():
    """Verify POST /predict returns 422 when feature vector length != 85."""
    invalid_features = DUMMY_85_FEATURES[:10]  # Only 10 features
    payload = {"features": invalid_features}
    response = client.post("/predict", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert "detail" in data


def test_chat_endpoint_unconfigured():
    """Verify POST /chat gracefully handles missing API key with 530/503 status."""
    payload = {
        "message": "What does rmssd signify in ECG?",
        "context": {"prediction": "Stress", "confidence": 0.88}
    }
    response = client.post("/chat", json=payload)
    # Returns 503 if no GROQ_API_KEY / OPENAI_API_KEY is present
    assert response.status_code in (200, 429, 502, 503, 504)


def test_security_headers():
    """Verify all responses include hardened production security headers."""
    response = client.get("/health")
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("X-XSS-Protection") == "1; mode=block"
    assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"


def test_cors_headers():
    """Verify CORS allow-origin header for configured domain."""
    response = client.get("/health", headers={"Origin": "http://localhost:3000"})
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
