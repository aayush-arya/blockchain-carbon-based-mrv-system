# AI/ML Pipeline

## What this is, honestly

There is no labeled dataset of mangrove/seagrass/salt-marsh field photos available in this
environment, and no claim is made that a model was trained on one. `ml-service` supports two
classification modes (`ML_MODEL_MODE`, default `pretrained`) - neither is fine-tuned on labeled
blue-carbon imagery, and both are honest about it in every response's `warnings` array, but they
are not equally informative, which is worth being precise about (see below).

Section 2 of the project synopsis is explicit that a trained CNN (as used in the cited
literature — Wei et al. for mangrove mapping, Langlois et al. for seagrass detection) is the
right approach for production use, and that classification must stay separate from coverage
estimation, which must stay separate from area/carbon calculation. This implementation follows
that separation; only the classification/coverage step is a heuristic stand-in for the trained
model a production system would use.

## Two independent techniques, not one blended guess

### 1. Vegetation coverage — Excess Green Index

`app/services/vegetation_index.py` computes `ExG = 2G - R - B` per pixel (Woebbecke et al.,
1995), a standard vegetation index in agricultural/ecological remote sensing for separating
green vegetation from soil/water/background in plain RGB imagery — no training required. An
adaptive threshold (Otsu's method, computed from the image's own ExG histogram rather than a
fixed magic number) splits pixels into vegetation/non-vegetation, and coverage % is the
fraction of the frame classified as vegetation.

This estimates the **visible vegetated proportion of the photographed frame** — not a
physical ground area. The backend's carbon calculation (`apps/backend/src/services/
carbonCalculationService.ts`) is the step that multiplies this percentage by a
separately-reported plot area to get an effective vegetated area; the AI service never claims
to measure area itself.

Known limitation: ExG is less reliable on yellow/tan soils where the green channel sits close
to the red/blue midpoint (verified directly in `ml-service/tests/test_vegetation_index.py` —
a light tan color scores ambiguously, while a proper brown soil tone scores correctly low). A
production system would validate against a labeled test set and likely combine ExG with
additional indices or a trained segmentation model.

### 2. Ecosystem classification — two modes, chosen by `ML_MODEL_MODE`

**`heuristic`** (`app/services/heuristic_classifier.py`) extracts five features from the image
(blueness, greenness, texture/std-dev, brightness, saturation) and scores it against three
**hand-authored** reference feature vectors — one per ecosystem, documented inline with the
visual reasoning behind each (e.g. seagrass photos are usually underwater and blue-shifted;
mangrove canopy is more textured than open marsh grass). Scoring is negative Euclidean distance
to each prototype, softmax-normalized into probabilities that sum to 1.

This is explicitly **not** a trained classifier, and it has a provable, structural limit worth
stating plainly: the three hand-guessed prototypes sit close enough together in feature space
that **no input can ever score above ~43% confidence** (computed directly by minimizing the
softmax over the prototype vectors themselves, not measured from a sample of images - see the
git history for the derivation). A correct prediction and a wrong one can carry near-identical
confidence, which is a real usability problem: nothing about the number tells a validator
whether to trust it.

**`pretrained`** (`app/services/pretrained_classifier.py`, the default) uses zero-shot
classification via CLIP (`openai/clip-vit-base-patch32`, Radford et al. 2021) — a real model
pretrained on ~400M real image-text pairs, compared against short text descriptions of each
ecosystem rather than three guessed numbers. It is still not fine-tuned on labeled blue-carbon
imagery (that dataset doesn't exist here), so it is not a determination either - but "not
fine-tuned on domain data" is not the same claim as "equally uninformative," and testing this
against a real, verifiably-labeled mangrove-forest photo (Sundarbans, CC BY-SA 4.0, Pinakpani
via Wikimedia Commons) produced 98.7% confidence for the correct class, against the heuristic's
~43% ceiling for any input whatsoever. Both modes carry an honest `warnings` entry; only one of
them gives a validator a confidence number actually worth reading.

Both modes have a real, opposite-direction failure mode worth knowing: the heuristic can be
fooled by hand-tuning an image's color/texture statistics without it looking like anything real
(verified directly - an image engineered to match the mangrove prototype scored CLIP's classes
57%/29%/13%, correctly unconvinced, since it doesn't look like a real photograph of anything).
CLIP, conversely, judges the *scene* holistically and can be confidently right about ecosystem
type from a wide landscape shot that is mostly sky and water - useful for classification, but a
reminder that classification confidence says nothing about whether *this specific frame* is a
good input for the coverage estimate below, which only looks at pixels.

## API contract

`POST /analyze` (multipart, field name `image`) → see `app/schemas.py` for the full response
shape. Every response includes `model_name`, `model_mode`, `confidence`, `vegetation_coverage_pct`,
`inference_ms`, a `warnings` array, and an `explanation` object with the per-ecosystem scores, so
a caller can render a "how was this calculated" panel rather than just a bare prediction.
`explanation.features` is populated only in `heuristic` mode (its raw blueness/greenness/texture/
brightness/saturation vector) - `pretrained` mode has no equivalent per-feature breakdown to
show, so it's an empty object there, not fabricated numbers.

## On the earlier decision to skip `pretrained` mode

This doc previously argued against implementing `pretrained` mode at all, on the reasoning that
zero-shot CLIP "still isn't a model that has seen labeled blue-carbon imagery" and would just
be "a differently-caveated guess" - true as far as it went, but it undersold the actual
difference in kind between a 400M-pair-trained embedding space and three hand-guessed numbers.
Both are honestly not fine-tuned on domain data; they are not equally uninformative, and the
heuristic's provable ~43% confidence ceiling (discovered by directly testing it, not by
assumption) is a real usability problem the earlier reasoning hadn't actually measured. Recorded
here rather than silently rewritten, since the correction itself - "verify before asserting
a limitation is fundamental" - is the more durable lesson.

The honest path to something *better than either current mode* is still fine-tuning on a
labeled dataset, per the synopsis's own literature review and future-scope section. `pretrained`
mode is a real improvement over the heuristic, not a substitute for that.

## Backend integration

`apps/backend` calls this service over HTTP (`ML_SERVICE_URL`) rather than embedding it, so it
can be scaled, restarted, or swapped independently, and so a Python dependency issue can never
take down the Node API process. See `docs/ARCHITECTURE.md` for how this fits the rest of the
lineage from evidence to tokenized asset.
