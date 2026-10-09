# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

SPL3 is a time-series forecasting project ("Visual TS Forecasting Library") whose headline goal is evaluating **Tensor-AR / PowerCast** against baselines (SARIMA, ETS, DLinear, iTransformer, TimeXer, TimeMixer). It has two halves:

- `backend/` + `frontend/` — the actual web app (FastAPI + Next.js). Self-contained; nothing outside these two folders is needed at runtime.
- `research/` — everything non-app, see `research/README.md`: `research/experiment/`, `research/experiment-passed/`, `research/experiment-failed/` — research notebooks/CSVs (M4, ILI, weather, traffic, GECCO anomaly, Bangladesh rainfall, etc.). Not part of the app; treat as scratch/analysis. `research/docs/technical_report.md` is the best overview of the app's design and decisions; `research/docs/diagrams/` holds drawio diagrams.
- `env/` (virtualenv) and `.kilo/` are untracked/tooling — ignore.

## Commands

Backend (run from `backend/`, venv at `../env`; PostgreSQL database `tsf_forecasting_app`, default connection is local peer auth, override via `backend/.env` / `DATABASE_URL`):

```
pip install -r requirements.txt
alembic upgrade head                 # apply migrations
alembic revision --autogenerate -m "msg"
python -m app.seed                   # idempotent: seeds 7 model rows + 3 system datasets
python -m app.promote_admin <email>  # only way to create an admin
uvicorn app.main:app --reload        # API on :8000, /health for liveness
```

Frontend (run from `frontend/`):

```
npm run dev      # :3000
npm run build
npm run lint
npm run test:e2e # Playwright acceptance tests (see frontend/e2e/README.md; needs port 8000 free, uses isolated DB tsf_e2e)
```

There is no unit-test suite; acceptance tests live in `frontend/e2e/` (Playwright). `frontend/AGENTS.md` warns that this Next.js (16.x) has breaking changes — read the relevant guide in `frontend/node_modules/next/dist/docs/` before writing frontend code (e.g. route protection lives in `frontend/proxy.ts`, not `middleware.ts`).

## Architecture

**Registry pattern.** DB rows for models/datasets hold only metadata (slug, name, description, hyperparam defaults); the actual implementation is resolved by slug through plain dicts: `app/services/model_registry.py` (`MODEL_BUILDERS`) and `app/services/dataset_registry.py`. Adding a model = new class in `app/forecasting/models/`, export it through the bridge, add a builder entry, and add a row to `app/seed.py`.

**`app/forecasting/` is a copied research library (`tsf_compare`)** that uses bare imports (`import config`, `from models.x import ...`). Its directory is put on `sys.path` in exactly one place, `app/services/forecasting_bridge.py`. Every other backend module must import forecasting code from the bridge, never from `app.forecasting.*` directly.

**Experiment execution** (`app/services/experiment_runner.py`): experiments are dispatched to a `ProcessPoolExecutor` (2 workers, **spawn** context) rather than threads/fork — threads starved uvicorn via the GIL during torch training, and fork would share Postgres sockets. Workers open their own DB session, run `period_split()`, fit the model, write a `Result` row plus actual/predicted `.npy` files under `backend/storage/experiments/`, and report per-epoch progress into the `Experiment` row (`progress_*`, `training_log`) which the frontend polls. `recover_orphaned_experiments()` runs at startup and marks stale pending/running experiments failed. Classical vs trained models are wired differently in the fit call (classical models get `eval_input` passed as `val_series` so train+val ends exactly where test begins — see docstrings in `forecasting/models/tensor_ar.py`).

**Backend layering:** `api/` (routers: auth, datasets, experiments, models, admin, public) → `schemas/` (Pydantic) → `services/` (logic, eligibility, uploads) → `db_models/` (SQLAlchemy 2.0 typed, 5 tables). Datasets are either system (loaders in `forecasting/datasets/`, data in `backend/data/`) or user uploads (`generic_csv` loader, files in `backend/storage/datasets/`).

**Auth:** JWT in an httpOnly `access_token` cookie issued by `/auth/login`. The frontend `proxy.ts` only checks cookie presence for redirects; real validation is server-side. Frontend calls the API via `lib/api.ts` (`apiFetch`, `credentials: "include"`, base `NEXT_PUBLIC_API_URL` default `http://localhost:8000`; backend CORS allows `http://localhost:3000`).

**Frontend:** Next.js App Router; authenticated pages under `app/(dashboard)/` (datasets, experiments, compare, models, admin); per-resource API helpers in `lib/*.ts`; Plotly charts in `components/`.
