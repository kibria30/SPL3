#!/bin/sh
set -e

echo "[entrypoint] applying migrations"
alembic upgrade head

echo "[entrypoint] seeding models and system datasets (idempotent)"
# Dataset downloads need internet; a failure only marks that dataset as 'error' (retry via Admin > Refresh).
python -m app.seed || echo "[entrypoint] seed finished with errors (see above) -- continuing"

# Exactly ONE uvicorn worker: experiments run in an in-process ProcessPoolExecutor
# (max 2 jobs) and recover_orphaned_experiments() runs at startup.
echo "[entrypoint] starting API"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips="*"
