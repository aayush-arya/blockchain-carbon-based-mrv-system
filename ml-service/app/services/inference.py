import io
import time

from PIL import Image

from ..config import settings
from ..schemas import AnalysisExplanation, AnalyzeResponse
from .heuristic_classifier import classify_ecosystem as classify_heuristic
from .vegetation_index import estimate_vegetation_coverage

HEURISTIC_MODEL_NAME = "heuristic-exg-color-v1"
PRETRAINED_MODEL_NAME = "clip-vit-base-patch32-zeroshot"

HEURISTIC_WARNINGS = [
    "Development model: a hand-authored color/texture heuristic, not a model trained on "
    "labeled blue-carbon imagery. Treat ecosystem classification as a rough prior, not ground truth.",
    "Vegetation coverage is an image-based estimate over the visible frame (Excess Green "
    "Index), not a physical area measurement or a trained segmentation mask.",
]

PRETRAINED_WARNINGS = [
    "Zero-shot classification via CLIP (openai/clip-vit-base-patch32), a real model "
    "pretrained on general image-text pairs - NOT fine-tuned on labeled blue-carbon "
    "imagery, because no such dataset exists in this project. Treat ecosystem "
    "classification as an informed prior, not ground truth.",
    "Vegetation coverage is an image-based estimate over the visible frame (Excess Green "
    "Index), not a physical area measurement or a trained segmentation mask.",
]


def _load_and_downscale(image_bytes: bytes) -> Image.Image:
    image = Image.open(io.BytesIO(image_bytes))
    image.load()
    max_dim = settings.max_image_dimension
    if max(image.size) > max_dim:
        image.thumbnail((max_dim, max_dim), Image.LANCZOS)
    return image


def analyze_image(image_bytes: bytes) -> AnalyzeResponse:
    start = time.perf_counter()

    image = _load_and_downscale(image_bytes)
    coverage = estimate_vegetation_coverage(image)

    if settings.model_mode == "pretrained":
        from .pretrained_classifier import classify_ecosystem as classify_pretrained

        classification = classify_pretrained(image)
        model_name = PRETRAINED_MODEL_NAME
        warnings = list(PRETRAINED_WARNINGS)
        features = None
    else:
        classification = classify_heuristic(image)
        model_name = HEURISTIC_MODEL_NAME
        warnings = list(HEURISTIC_WARNINGS)
        features = classification.features

    inference_ms = int((time.perf_counter() - start) * 1000)

    return AnalyzeResponse(
        model_name=model_name,
        model_mode=settings.model_mode,  # type: ignore[arg-type]
        predicted_ecosystem=classification.predicted_ecosystem,  # type: ignore[arg-type]
        confidence=classification.confidence,
        vegetation_coverage_pct=coverage.coverage_pct,
        inference_ms=inference_ms,
        warnings=warnings,
        explanation=AnalysisExplanation(
            ecosystem_scores=classification.scores,
            features=features or {},
            coverage_method="excess_green_index_otsu_threshold",
            coverage_threshold_used=coverage.threshold_used,
            coverage_mean_index=coverage.mean_exg,
        ),
    )
