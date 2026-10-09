# Visual TS Forecasting Library

A full-stack web app for comparing time-series forecasting models. Upload your own data or pick a built-in
dataset, run one or several models on the **same backtest split**, and compare their errors, speed and size
on charts and a leaderboard.

Its headline goal is evaluating **Tensor-AR ("PowerCast")**, a tensor-decomposition-based forecaster, against
statistical and deep-learning baselines. The app turns the `tsf_compare` research code into an interactive,
multi-user platform with persistent results.

## Features

- **Accounts:** register / log in (JWT in an httpOnly cookie), per-user data, and an admin role.
- **Datasets:** three built-in datasets (Weather, Traffic, ILI) plus CSV/Excel upload with column selection,
  private/public visibility, preview and column statistics.
- **Experiments:** pick dataset, columns, model, test/input window and hyperparameters. A live split preview shows
  which models are eligible for that split. Runs execute in the background with progress and a training log.
- **Results:** actual-vs-predicted charts per feature, and a metrics table (MSE, MAE, RMSE, MASE, sMAPE).
- **Comparisons:** run several models on one split and get a leaderboard plus training-time and parameter-count charts.
- **Anomaly detection:** Tensor-AR forecast residuals flag probable anomalies, with an adjustable threshold.
- **Admin:** manage user roles, refresh built-in datasets, set dataset visibility, delete user datasets.

## Models

| Slug | Model | Type |
|---|---|---|
| `tensor_ar` | Tensor-AR (CP / CP-Puzzle decomposition + AutoReg) | Classical |
| `sarima` | SARIMA | Classical |
| `ets` | ETS (Holt-Winters) | Classical |
| `dlinear` | DLinear | Deep learning |
| `itransformer` | iTransformer | Deep learning |
| `timexer` | TimeXer | Deep learning |
| `timemixer` | TimeMixer | Deep learning |

Deep-learning models need enough training windows, so they are only offered when the chosen split leaves
enough data; classical models always run.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Plotly.js |
| Backend | FastAPI, SQLAlchemy 2.0, Alembic, Pydantic |
| Forecasting | NumPy, pandas, scikit-learn, PyTorch, tensorly, tensordecomp, statsmodels |
| Database | PostgreSQL |
| Deployment | Docker Compose, Caddy reverse proxy |
| Tests | Playwright (browser acceptance tests) |

## Repository layout

```
backend/     FastAPI app (api/, schemas/, services/, db_models/, forecasting/), Alembic migrations
frontend/    Next.js app, plus e2e/ (Playwright tests)
deploy/      Caddy configuration
research/    Notebooks, experiment data and design docs (not needed to run the app)
docker-compose.yml, .env.example, DEPLOY.md
```

## Quick start with Docker

Requires Docker with the Compose plugin and internet access (first start downloads the datasets).

```bash
cp .env.example .env        # set POSTGRES_PASSWORD, JWT_SECRET (openssl rand -hex 32), HTTP_PORT
docker compose up -d --build
```

Open `http://localhost:8742` (or the `HTTP_PORT` you set). Register an account, then make it an admin:

```bash
docker compose exec backend python -m app.promote_admin you@example.com
```

Only Caddy publishes a port. It serves the frontend and forwards `/api/*` to the backend, so the browser
talks to a single origin. See [DEPLOY.md](DEPLOY.md) for VPS deployment, backups, updates and enabling HTTPS.

## Local development

You need Python 3.10+, Node 22+ and a PostgreSQL database named `tsf_forecasting_app`
(the default connection uses local peer auth; override with `DATABASE_URL`).

**Backend** (from `backend/`):
```bash
pip install -r requirements.txt
alembic upgrade head
python -m app.seed                   # 7 models + 3 system datasets (needs internet on first run)
python -m app.promote_admin <email>  # after registering, to create an admin
uvicorn app.main:app --reload        # API on :8000, health check at /health
```

**Frontend** (from `frontend/`):
```bash
npm install
npm run dev                          # http://localhost:3000
```

The frontend reads `NEXT_PUBLIC_API_URL` from `frontend/.env.local` (default `http://localhost:8000`).
The backend reads optional overrides (`DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`) from `backend/.env`.

## Configuration

| File | Used for |
|---|---|
| `.env` (repo root) | Docker Compose: database credentials, `JWT_SECRET`, `HTTP_PORT` |
| `frontend/.env.local` | Local frontend dev: `NEXT_PUBLIC_API_URL` |
| `backend/.env` | Local backend dev overrides (optional) |

All `.env` files are git-ignored. Use `.env.example` as the template for the root one.

## Testing

Browser acceptance tests (Playwright) cover auth, datasets, models, experiments, comparisons and admin pages,
plus API contract checks. They run against a fresh, isolated database (`tsf_e2e`) and never touch your dev data.

```bash
cd frontend
npx playwright install chromium     # once
npm run test:e2e                    # full suite (~1 min), needs port 8000 free
npm run test:e2e:demo               # headed and slowed down so you can watch
```

Details are in [frontend/e2e/README.md](frontend/e2e/README.md).

## How it works

- **Registry pattern:** database rows hold only metadata (slug, name, defaults). Implementations are looked up by
  slug in `app/services/model_registry.py` and `dataset_registry.py`. To add a model: add a class under
  `app/forecasting/models/`, register a builder, and add a row to `app/seed.py`.
- **Experiment execution:** jobs run in a `ProcessPoolExecutor` (2 workers, spawn) so training never blocks the API.
  Workers write results to the database and `.npy` files, and report per-epoch progress that the UI polls.
  Experiments left running by a restart are marked failed at startup.
- **Auth:** the JWT cookie is validated server-side; the frontend `proxy.ts` only checks the cookie's presence to redirect.

For the full design and decisions, read [research/docs/technical_report.md](research/docs/technical_report.md).

## Notes and limitations

- Runs on CPU only. SARIMA on large datasets can take several minutes.
- Run the backend with a single uvicorn worker (experiments run inside that process).
- The Weather dataset is fetched live from Open-Meteo, so it needs internet and can differ slightly between dates.
- The first admin can only be created with the `promote_admin` command; after that, admins manage roles in the UI.
