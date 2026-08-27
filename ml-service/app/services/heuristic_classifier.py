"""Rule-based ecosystem classifier used when no trained model is configured.

IMPORTANT — read before trusting this for anything real: this is a hand-authored heuristic
over simple color/texture statistics, not a model trained on labeled blue-carbon imagery (no
such dataset was available to build one in this environment). The per-ecosystem "prototype"
feature vectors below are informed by generally-known visual characteristics of each habitat
type (documented inline), not measured from real photos. It exists so the pipeline is
genuinely runnable end-to-end and every prediction is honestly labeled `model_mode=heuristic`
with a confidence and warnings array - see docs/AI_PIPELINE.md for what a production version
would need (a labeled dataset and a fine-tuned CNN, per the literature cited in the project
synopsis).
"""

from dataclasses import dataclass

import numpy as np
from PIL import Image

ECOSYSTEM_CODES = ("mangrove", "seagrass", "salt_marsh")

# Hand-authored reference feature vectors, one per ecosystem, in the same feature space
# computed by `_extract_features`. Distance-based, not a trained decision boundary.
#
#   blueness:   how blue-shifted the image is, relative to red/green. Seagrass photos are
#               most often taken underwater, which imparts a strong blue/cyan cast.
#   greenness:  how green-dominant the image is. Vegetated scenes generally score higher;
#               mangrove canopy and salt-marsh grass both score high, open water/mud low.
#   texture:    std. deviation of grayscale intensity, a crude proxy for visual complexity.
#               Mangrove canopy (leaves, branches, shadows, aerial roots) tends to be more
#               textured than a relatively uniform grass marsh or a water-blurred seagrass bed.
#   brightness: mean grayscale intensity. Seagrass (underwater, light-attenuated) tends darker;
#               salt marsh (open, low vegetation, direct sun) tends brighter.
#   saturation: mean HSV saturation.
_PROTOTYPES: dict[str, np.ndarray] = {
    "mangrove": np.array([0.15, 0.55, 0.45, 0.50, 0.55]),
    "seagrass": np.array([0.55, 0.35, 0.25, 0.35, 0.40]),
    "salt_marsh": np.array([0.10, 0.50, 0.20, 0.65, 0.45]),
}
_FEATURE_NAMES = ("blueness", "greenness", "texture", "brightness", "saturation")


@dataclass
class ClassificationResult:
    predicted_ecosystem: str
    confidence: float
    scores: dict[str, float]
    features: dict[str, float]


def _extract_features(image: Image.Image) -> np.ndarray:
    rgb = np.asarray(image.convert("RGB")).astype(np.float32) / 255.0
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]

    blueness = float(np.clip((b - (r + g) / 2).mean() + 0.5, 0, 1))
    greenness = float(np.clip((g - (r + b) / 2).mean() + 0.5, 0, 1))

    grayscale = np.asarray(image.convert("L")).astype(np.float32) / 255.0
    texture = float(np.clip(grayscale.std() * 3, 0, 1))
    brightness = float(grayscale.mean())

    hsv = np.asarray(image.convert("HSV")).astype(np.float32) / 255.0
    saturation = float(hsv[..., 1].mean())

    return np.array([blueness, greenness, texture, brightness, saturation])


def classify_ecosystem(image: Image.Image) -> ClassificationResult:
    features = _extract_features(image)

    # Similarity = negative Euclidean distance to each prototype, then softmax so scores are
    # comparable probabilities that sum to 1. Confidence is genuinely derived from how close
    # the image sits to one prototype versus the others, not a fixed number.
    distances = {code: float(np.linalg.norm(features - proto)) for code, proto in _PROTOTYPES.items()}
    neg_distances = np.array([-distances[code] for code in ECOSYSTEM_CODES])
    exp_scores = np.exp(neg_distances - neg_distances.max())
    softmax = exp_scores / exp_scores.sum()

    scores = {code: round(float(score), 4) for code, score in zip(ECOSYSTEM_CODES, softmax)}
    predicted = max(scores, key=lambda code: scores[code])

    return ClassificationResult(
        predicted_ecosystem=predicted,
        confidence=scores[predicted],
        scores=scores,
        features={name: round(float(value), 4) for name, value in zip(_FEATURE_NAMES, features)},
    )
