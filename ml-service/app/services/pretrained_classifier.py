"""Zero-shot ecosystem classification using CLIP (Radford et al. 2021), OpenAI's original
openai/clip-vit-base-patch32 checkpoint - a real model pretrained on ~400M real image-text
pairs, used here in its unmodified, general-purpose form.

Precise about what this is NOT: it is not fine-tuned on labeled blue-carbon imagery (no such
dataset exists in this project - that's the whole reason the heuristic classifier exists as the
default). This compares the input image against a handful of hand-written text descriptions per
ecosystem and reports how well each matches, via CLIP's own learned joint image/text embedding
space - not domain-specific training. Confidence numbers from this are genuinely more
informative than the heuristic's (a real 400M-pair-trained embedding space actually separates
these three scenes; three hand-guessed 5-number prototypes do not, and are provably capped
around 43% confidence for any input - see the heuristic module's docstring), but "zero-shot
CLIP" is still meaningfully weaker than a model fine-tuned on verified ground-truth blue-carbon
photos would be. Both facts belong in the warnings this returns, not just one.
"""

from dataclasses import dataclass
from functools import lru_cache

import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

MODEL_CHECKPOINT = "openai/clip-vit-base-patch32"

ECOSYSTEM_PROMPTS: dict[str, str] = {
    "mangrove": (
        "an aerial or ground-level photo of a mangrove forest, dense tangled trees and "
        "prop roots growing directly out of coastal tidal water and mud"
    ),
    "seagrass": (
        "an underwater photo of a seagrass meadow, green grass-like blades growing on a "
        "sandy or muddy seafloor beneath the ocean surface"
    ),
    "salt_marsh": (
        "a photo of a coastal salt marsh, low grasses and reeds growing across a flat "
        "muddy or sandy tidal wetland"
    ),
}
ECOSYSTEM_CODES = tuple(ECOSYSTEM_PROMPTS.keys())


@dataclass
class ClassificationResult:
    predicted_ecosystem: str
    confidence: float
    scores: dict[str, float]


@lru_cache(maxsize=1)
def _load_model() -> tuple[CLIPModel, CLIPProcessor]:
    """Loaded once per process (~6s from local cache, ~600MB one-time download on first ever
    run) and reused for every request after - not per-request, which would make each /analyze
    call pay the load cost."""
    model = CLIPModel.from_pretrained(MODEL_CHECKPOINT)
    processor = CLIPProcessor.from_pretrained(MODEL_CHECKPOINT)
    model.eval()
    return model, processor


def warm_up() -> None:
    """Called at service startup so the first real request isn't the one that pays the load
    cost - see main.py."""
    _load_model()


def classify_ecosystem(image: Image.Image) -> ClassificationResult:
    model, processor = _load_model()
    texts = [ECOSYSTEM_PROMPTS[code] for code in ECOSYSTEM_CODES]

    inputs = processor(text=texts, images=image.convert("RGB"), return_tensors="pt", padding=True)
    with torch.no_grad():
        outputs = model(**inputs)
    probs = outputs.logits_per_image.softmax(dim=1)[0].tolist()

    scores = {code: round(float(p), 4) for code, p in zip(ECOSYSTEM_CODES, probs)}
    predicted = max(scores, key=lambda code: scores[code])

    return ClassificationResult(predicted_ecosystem=predicted, confidence=scores[predicted], scores=scores)
