FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Bakes the CLIP checkpoint into the image (pretrained is the project default - see
# .env.example) so it never depends on network access at container startup: the build has a
# generous time budget, a container's healthcheck window doesn't, and a slow/blocked download
# there previously made the container come up unhealthy (an HF Hub read timeout, not a code
# bug). Skippable via BAKE_PRETRAINED_MODEL=false for a heuristic-only deployment (e.g. the
# free-tier Render config in render.yaml) where the ~600MB is pure waste - it's never loaded at
# runtime in that mode, just sitting unused in the image.
ARG BAKE_PRETRAINED_MODEL=true
RUN if [ "$BAKE_PRETRAINED_MODEL" = "true" ]; then \
      python -c "from app.services.pretrained_classifier import warm_up; warm_up()"; \
    else \
      echo "Skipping CLIP checkpoint bake (BAKE_PRETRAINED_MODEL=false)"; \
    fi

EXPOSE 8010
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8010"]
