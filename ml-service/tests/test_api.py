import io

from fastapi.testclient import TestClient
from PIL import Image

from app.config import settings
from app.main import app

client = TestClient(app)


def make_image_bytes(color=(50, 160, 60), fmt="JPEG") -> bytes:
    image = Image.new("RGB", (64, 64), color=color)
    buffer = io.BytesIO()
    image.save(buffer, format=fmt)
    return buffer.getvalue()


def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    # Whichever mode this process is actually configured for (ML_MODEL_MODE) - both are real,
    # exercised paths (see test_analyze_returns_a_well_formed_response below), not just one.
    assert body["model_mode"] == settings.model_mode


def test_analyze_returns_a_well_formed_response():
    res = client.post(
        "/analyze",
        files={"image": ("test.jpg", make_image_bytes(), "image/jpeg")},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["model_mode"] == settings.model_mode
    assert body["predicted_ecosystem"] in ("mangrove", "seagrass", "salt_marsh")
    assert 0 <= body["confidence"] <= 1
    assert 0 <= body["vegetation_coverage_pct"] <= 100
    assert len(body["warnings"]) >= 1
    assert "explanation" in body
    if settings.model_mode == "heuristic":
        # Only the heuristic path reports its raw feature vector - pretrained mode's
        # explanation carries ecosystem_scores but no equivalent per-feature breakdown.
        assert set(body["explanation"]["features"].keys()) == {
            "blueness", "greenness", "texture", "brightness", "saturation",
        }


def test_analyze_rejects_unsupported_content_type():
    res = client.post(
        "/analyze",
        files={"image": ("test.txt", b"not an image", "text/plain")},
    )
    assert res.status_code == 400


def test_analyze_rejects_empty_file():
    res = client.post(
        "/analyze",
        files={"image": ("empty.jpg", b"", "image/jpeg")},
    )
    assert res.status_code == 400


def test_analyze_rejects_corrupt_image_bytes():
    res = client.post(
        "/analyze",
        files={"image": ("bad.jpg", b"\xff\xd8\xff\xe0not-actually-a-jpeg", "image/jpeg")},
    )
    assert res.status_code == 400
