FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# libpq is bundled in psycopg2-binary; libgomp1 is needed by torch/numpy OpenMP; curl for healthcheck.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgomp1 curl \
 && rm -rf /var/lib/apt/lists/*

# CPU-only torch (the default PyPI wheel drags in ~2 GB of CUDA libs the VPS can't use).
# Installed first so the later `pip install -r` sees it as already satisfied.
RUN pip install --upgrade pip \
 && pip install "torch==2.13.0+cpu" --index-url https://download.pytorch.org/whl/cpu --extra-index-url https://pypi.org/simple

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY alembic.ini .
COPY alembic ./alembic
COPY app ./app
COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh \
 && useradd --create-home --uid 10001 appuser \
 && mkdir -p /app/storage /app/data \
 && chown -R appuser:appuser /app

USER appuser

# Dataset caches (./data) and uploads/results (./storage) are volumes -- see docker-compose.yml.
VOLUME ["/app/storage", "/app/data"]
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=5 \
  CMD curl -fsS http://127.0.0.1:8000/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
