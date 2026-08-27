import logging

from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import UnidentifiedImageError

from .config import settings
from .schemas import AnalyzeResponse, HealthResponse
from .services.inference import HEURISTIC_MODEL_NAME, analyze_image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ml-service")

app = FastAPI(
    title="Blue Carbon MRV - AI/ML Service",
    description=(
        "Ecosystem classification and vegetation coverage estimation for field evidence images. "
        "See docs/AI_PIPELINE.md in the repo root for the model's methodology and limitations."
    ),
    version="0.1.0",
)

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", model_mode=settings.model_mode, model_name=HEURISTIC_MODEL_NAME)


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(image: UploadFile = File(...)) -> AnalyzeResponse:
    if image.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported content type: {image.content_type}")

    body = await image.read()
    if len(body) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Image exceeds the 15MB limit")
    if len(body) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        result = analyze_image(body)
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(status_code=400, detail="Could not decode image") from exc
    except Exception:
        logger.exception("Inference failed")
        raise HTTPException(status_code=500, detail="Inference failed") from None

    return result
