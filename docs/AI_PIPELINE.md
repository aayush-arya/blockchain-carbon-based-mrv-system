# AI/ML Pipeline

## What this is, honestly

There is no labeled dataset of mangrove/seagrass/salt-marsh field photos available in this
environment, and no claim is made that a model was trained on one. `ml-service` runs a
**heuristic development model** (`model_mode: "heuristic"` in every response) built from two
real, deterministic, explainable computer-vision techniques — not a fabricated or hardcoded
result. Every response is labeled with its `model_mode` and carries a `warnings` array stating
these limitations, so the web/mobile UI can surface them rather than presenting a bare number.

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

### 2. Ecosystem classification — nearest-prototype heuristic

`app/services/heuristic_classifier.py` extracts five features from the image (blueness,
greenness, texture/std-dev, brightness, saturation) and scores it against three
**hand-authored** reference feature vectors — one per ecosystem, documented inline with the
visual reasoning behind each (e.g. seagrass photos are usually underwater and blue-shifted;
mangrove canopy is more textured than open marsh grass). Scoring is negative Euclidean
distance to each prototype, softmax-normalized into probabilities that sum to 1. Confidence is
the winning class's own probability — genuinely computed from how separated it is from the
other two, not a fixed or randomly-varied number.

This is explicitly **not** a trained classifier. The prototypes are reasoned assumptions about
typical appearance, not statistics measured from real labeled photos. Treat its output as a
rough prior a human validator should weigh, not a determination.

## API contract

`POST /analyze` (multipart, field name `image`) → see `app/schemas.py` for the full response
shape. Every response includes `model_name`, `model_mode`, `confidence`, `vegetation_coverage_pct`,
`inference_ms`, a `warnings` array, and an `explanation` object with the per-ecosystem scores
and extracted features, so a caller can render an "how was this calculated" panel rather than
just a bare prediction.

## Why there's no `pretrained` mode yet

`ML_MODEL_MODE` supports `"pretrained"` as a documented future option. PyTorch does install
cleanly on this environment's Python 3.14 (confirmed), but a pretrained *general* ImageNet
backbone doesn't actually solve this task more honestly than the heuristic above — mapping
1000 ImageNet classes onto "mangrove/seagrass/salt-marsh," or running zero-shot CLIP-style
classification, still isn't a model that has seen labeled blue-carbon imagery. It would add a
real dependency and a large download for a result that carries the same fundamental caveat.
The honest path to a real `pretrained` mode is fine-tuning on a labeled dataset, per the
synopsis's own literature review and future-scope section — not swapping in a differently-caveated
guess.

## Backend integration

`apps/backend` calls this service over HTTP (`ML_SERVICE_URL`) rather than embedding it, so it
can be scaled, restarted, or swapped independently, and so a Python dependency issue can never
take down the Node API process. See `docs/ARCHITECTURE.md` for how this fits the rest of the
lineage from evidence to tokenized asset.
