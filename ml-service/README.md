# AI/ML Service

FastAPI service that classifies blue-carbon ecosystem type and estimates vegetation coverage
from a field-evidence image. See [`docs/AI_PIPELINE.md`](../docs/AI_PIPELINE.md) at the repo
root for the full methodology and its honestly-stated limitations before trusting any output.

## Run locally

```bash
python -m venv .venv
./.venv/Scripts/activate   # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --port 8010 --reload
```

Health check: `GET http://localhost:8010/health`

## Test

```bash
pytest -v
```

## API

`POST /analyze` — multipart form, field name `image` (jpeg/png/webp/heic, ≤15MB). Returns
classification + coverage + confidence + a full `explanation` breakdown. See `app/schemas.py`
for the exact response shape and `app/main.py` for validation rules.
