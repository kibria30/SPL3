# Visual TS Forecasting Library — Technical Report

Reference document for preparing the project report and presentation slides. Covers purpose,
architecture, data model, features, key engineering decisions, and challenges solved.

---

## 1. Purpose

A full-stack web application that lets a user upload or select a time-series dataset, run a
forecasting model against it, and see how well the forecast matches reality — with a particular
focus on evaluating **Tensor-AR ("PowerCast")**, a custom tensor-decomposition-based forecasting
method, side by side against established baselines (statistical and deep-learning) on the same
data and the same backtest split. The app operationalizes an existing research codebase
(`tsf_compare`) as an interactive, multi-user, persistent platform rather than a one-off script.

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | FastAPI (Python), Uvicorn ASGI server |
| ORM / migrations | SQLAlchemy 2.0 (typed `Mapped[...]` models), Alembic |
| Database | PostgreSQL |
| Auth | JWT in httpOnly cookies, `bcrypt` for password hashing |
| Forecasting core | Copied from the `tsf_compare` research library (NumPy, pandas, scikit-learn, PyTorch, `tensorly`, `statsmodels`) |
| Async execution | Python `ProcessPoolExecutor` (spawn context) |
| Frontend framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Charting | Plotly.js via `react-plotly.js` |

## 3. Architecture

```
frontend/ (Next.js)  ──HTTP(JSON, cookies)──►  backend/app/ (FastAPI)
                                                    │
                                                    ├── api/          route handlers
                                                    ├── schemas/      Pydantic request/response models
                                                    ├── db_models/    SQLAlchemy ORM models (5 tables)
                                                    ├── services/     business logic / glue
                                                    └── forecasting/  copied tsf_compare library
                                                            │
                                                    PostgreSQL (tsf_forecasting_app)
```

**Independence by design.** `backend/` and `frontend/` were deliberately built as self-contained
folders, independent of the rest of the researcher's repo. The forecasting research code
(`tsf_compare`) was **copied** (not referenced via `sys.path` or a package dependency) into
`backend/app/forecasting/`, so the web app has no runtime dependency on anything outside its own
two folders.

**Registry pattern instead of a heavyweight plugin system.** Both models and datasets follow the
same shape: a database row holds only *metadata* (name, slug, description, paper citation for
models; name, slug, column list for datasets), while a plain Python dict (`model_registry.py`,
`dataset_registry.py`) maps `slug → actual class/loader`. This mirrors the original research
library's own `MODEL_REGISTRY`/`DATASETS` config pattern, so adding a new model or dataset to the
web app is the same shape of change as adding one to the research library.

## 4. Database Schema

Deliberately constrained to **5 tables** — the app's query patterns are "fetch one experiment's
full detail" or "fetch one user's rows," never cross-experiment SQL aggregation, so per-feature
metrics and hyperparameters are stored as JSONB rather than normalized into further child tables.

| Table | Purpose | Notable columns |
|---|---|---|
| `users` | Accounts | `email` (unique), `password_hash` (bcrypt), `role` (`user`/`admin`) |
| `forecasting_models` | Metadata for the 7 supported models | `slug`, `family` (`classical`/`trained`), `default_hyperparams` (JSONB), `paper_title`, `publication`, `year`, `authors`, `github_url` |
| `datasets` | System + user-uploaded datasets | `slug` (system only), `source` (`system`/`user`), `visibility`, `period_length`, `available_columns`/`selected_columns` (JSONB), `status` |
| `experiments` | One model+dataset+split run | `task_type` (default `"forecasting"`, forward-compat discriminator), `test_periods`/`input_periods`/`output_periods`, `period_length`/`seq_len`/`pred_len` (snapshot at run time), `val_ratio`, `hyperparams` (JSONB override), `status` (`pending`/`running`/`completed`/`failed`) |
| `results` | One experiment's scored output | `metrics_per_feature`/`metrics_avg` (JSONB), `actual_sequence_path`/`predicted_sequence_path` (`.npy` files on disk), `training_time_seconds`, `num_parameters` |

Actual/predicted forecast arrays are stored as `.npy` files on disk (path recorded in `results`),
not inline in the database — kept out of Postgres since they're large numeric arrays read only by
the app itself for charting, not queried.

## 5. Forecasting Models

7 models across 2 families, seeded from `backend/app/seed.py`:

**Classical family** (`family=classical`, `requires_training=False`) — fit directly on all
pre-test history, no train/val split, always eligible regardless of dataset size:
- **Tensor-AR ("PowerCast")** — the project's own method. Reshapes pre-test history into a
  `(period, time, features)` tensor, fits a rank-R PARAFAC/CP decomposition (via `tensorly`),
  extrapolates each latent factor forward with `AutoReg(lags=1)`, reconstructs the forecast from
  the extrapolated factors. Unlike the trained models, it doesn't condition on an arbitrary input
  window — it always continues forward from the point it was fit on.
- **SARIMA** — one independent `SARIMAX(p,d,q)x(P,D,Q,period)` per channel.
- **ETS (Holt-Winters)** — one independent additive exponential-smoothing model per channel.

**Trained family** (`family=trained`, `requires_training=True`) — gradient-trained seq2seq
models, need a real train/validation split large enough for at least one input+output window:
- **DLinear** (Zeng et al., AAAI 2023) — decomposes input into trend + seasonal, one linear layer
  each, sums the two predictions.
- **iTransformer** (Liu et al., ICLR 2024) — inverts the usual attention axis: each variate's
  whole series becomes one token, attention runs across variates.
- **TimeXer** (Wang et al., NeurIPS 2024) — patch-embeds each variate plus a learned global token
  that cross-attends to whole-series embeddings of all variates.
- **TimeMixer** (Wang et al., ICLR 2024) — decomposes at multiple down-sampled scales, mixes
  seasonal bottom-up and trend top-down, sums per-scale predictors.

## 6. Datasets

- **Weather** (Open-Meteo, live-fetched, hourly, `period_length=24`)
- **Traffic** (California road occupancy, hourly, `period_length=24`)
- **ILI** (CDC Influenza-Like Illness, weekly, `period_length=52`)
- **User-uploaded CSV** — any user can upload their own multivariate series; columns are
  auto-typed and the user selects which numeric columns become forecast channels before the
  dataset is usable.

## 7. Core Workflow

### 7.1 Period-based train/test split

Unlike a simple ratio split, the app carves the test window off in units of the dataset's natural
seasonal *period* (`period_length`, e.g. 24 hours, 52 weeks):
- `test_periods` (8–25) — total periods held out for evaluation.
- `input_periods` (5–20, must be `< test_periods`) — of those, how many periods form the model's
  input window; the remainder (`output_periods = test_periods − input_periods`) is the forecast
  horizon.
- Everything before the test window is `train_series`.

This single-window backtest (`period_split()`) is deliberately **not** a rolling/continuous
evaluation — one held-out window per experiment, matching how the research library benchmarks
models.

### 7.2 Eligibility

Before an experiment can be created, `compute_eligibility()` determines which models can actually
run against the chosen split:
- Classical models are **always** eligible (they only ever need the eval input window).
- Trained models need `train_fit_len >= seq_len+pred_len` **and** `val_len >= seq_len+pred_len` —
  stricter than "any train data at all," because the underlying window-building step needs at
  least one full window from each of train and validation independently. If the dataset/split
  combination can't support this, trained models are excluded with an explanatory reason string
  shown in the UI.

### 7.3 Family-aware fitting

- **Trained models** get a genuine train/validation split (`val_ratio`, default 0.2) carved from
  `train_series`.
- **Classical models** are fit with the `eval_input` window smuggled into the same `val_series`
  argument slot, so their internal train+val concatenation ends exactly where the test window
  begins — otherwise a classical model's forecast origin would land hundreds of points before the
  actual test window and silently score against the wrong target (a bug caught and documented
  during development as "Bug #2").

### 7.4 Asynchronous execution

Experiment runs are dispatched to a **`ProcessPoolExecutor`** (2 workers, `spawn` context), not a
thread pool and not inline on the request thread.

- **Why not a thread pool:** heavy PyTorch training (e.g. TimeXer) holds Python's GIL for long
  stretches during autograd bookkeeping and tensor ops, which starved `uvicorn`'s asyncio event
  loop and froze the *entire* API — including unrelated polling GETs — for the duration of
  training. This was reproduced against real usage before being fixed. A `ProcessPoolExecutor`
  sidesteps this entirely — each worker is a separate interpreter with its own GIL, so heavy
  training in one worker can't block the main API process from serving other requests.
- **Why `spawn`, not the Linux-default `fork`:** forking after the SQLAlchemy engine/connection
  pool already exists would let the child inherit live Postgres socket file descriptors,
  corrupting both processes' connections under concurrent use. `spawn` starts a fresh interpreter
  that re-imports and re-creates its own engine.
- **Orphan recovery:** if the server restarts mid-run, the process pool that would have completed
  a `pending`/`running` experiment no longer exists, so it can never self-resolve. A startup hook
  (`recover_orphaned_experiments()`, run via a FastAPI `lifespan` context manager) marks any such
  stuck experiment `failed` with an explanatory message, instead of leaving it stuck "running"
  forever in a UI that polls expecting eventual completion. This fired for real during
  development and recovered two genuinely stuck experiments.
- **Frontend side:** a persistent job tracker (`ExperimentTracker.tsx`) polls in-flight
  experiments every ~2.5s and shows toast notifications on completion, so the user isn't stuck
  watching a blocked screen.

### 7.5 Scoring & storage

After `predict()`, metrics (MSE, MAE, RMSE, MASE, R², etc. — reusing the research library's own
`compute_metrics_table`/`summarize`) are computed per feature and averaged, then persisted as
JSONB alongside the raw actual/predicted `.npy` arrays for later charting.

## 8. Model Comparison ("Compare") Feature

Lets a user run several models against the *same* dataset and split configuration and see them
ranked side by side.

- **No new database table.** A "comparison cohort" is an implicit grouping — experiments sharing
  `(user_id, dataset_id, test_periods, input_periods, period_length)` — computed with a query,
  not a stored concept.
- **Batch creation** (`POST /experiments/compare-batch`) creates one experiment per selected
  model in one request; models that are ineligible for the chosen split are skipped with a reason
  rather than rejecting the whole batch.
- **Comparison view** (`GET /experiments/compare`) joins experiments, models, and results for one
  cohort. Results page order (per product decision): chart first, then a leaderboard table
  (client-sorted by MSE ascending), then per-model efficiency bar charts (training time /
  parameter count).
- **Fixed, permanent color-per-model.** Colors are assigned by a fixed seed order
  (`tensor_ar → sarima → ets → dlinear → itransformer → timexer → timemixer`) mapped onto 7 of the
  dataviz palette's 8 categorical slots — "Actual" is always blue, a given model is always the
  same color everywhere in the app, regardless of which subset of models is selected for a given
  comparison ("color follows the entity, never repaint the survivors").

## 9. API Surface

| Area | Routes |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Datasets | `GET /datasets`, `GET /datasets/{id}`, `POST /datasets/upload`, `PATCH /datasets/{id}`, `GET /datasets/{id}/preview`, `GET /datasets/{id}/split-preview` |
| Models | `GET /models` |
| Experiments | `POST /experiments`, `GET /experiments`, `GET /experiments/{id}`, `GET /experiments/{id}/result`, `GET /experiments/{id}/series` |
| Comparison | `POST /experiments/compare-batch`, `GET /experiments/compare`, `GET /experiments/compare/groups` |
| Admin | `POST /admin/datasets/system/{slug}/refresh`, `GET /admin/users`, `PATCH /admin/users/{id}/role` |
| Public | `GET /stats` (unauthenticated platform stats for the landing page) |

Route registration order matters under FastAPI/Starlette: literal routes like `/compare` must be
registered *above* the parameterized `/{experiment_id}` route, or path matching swallows them
into the int-parsing 422 path before they're ever reached — an issue hit and fixed during
development.

## 10. Frontend Structure

Next.js App Router, route groups separating public and authenticated areas:

- `app/page.tsx` — auth-aware landing page: marketing hero + platform stats when logged out,
  "welcome back" overview + shortcuts when logged in.
- `app/login`, `app/register` — auth forms.
- `app/(dashboard)/datasets`, `datasets/[id]`, `datasets/upload` — dataset browsing, detail,
  upload + column selection.
- `app/(dashboard)/models`, `models/[slug]` — model catalogue and detail (family, default
  hyperparameters, paper citation, description).
- `app/(dashboard)/experiments`, `experiments/new`, `experiments/[id]` — experiment list, creation
  form (with live eligibility feedback), and results page (chart, then metrics table).
- `app/(dashboard)/compare`, `compare/new`, `compare/view` — comparison cohort list, batch
  creation, and comparison results view.
- `app/(dashboard)/admin/users`, `admin/datasets` — admin-only user role management and system
  dataset refresh.

Shared components: `ForecastChart.tsx` (actual-vs-predicted line chart, per-feature selector),
`ModelComparisonChart.tsx`, `EfficiencyBarChart.tsx`, `ExperimentTracker.tsx` (background job
polling + toasts), `StatusBadge.tsx`, `StatTile.tsx`, `Nav.tsx`.

## 11. Visualization Design

Uses a validated 8-slot categorical color palette (from an internal dataviz design system) with
explicit light/dark hex values, shared via `frontend/lib/palette.ts` so every chart in the app
reads as one consistent visual system. "Actual" series are always blue; models get permanent
slots by seed order, not by selection order, so a model's color never changes based on which
other models happen to be in the same comparison. All charts render via Plotly with a
client-only (`ssr: false`) dynamic import, since Plotly touches `window` at import time.

## 12. Notable Engineering Challenges & Fixes

| Problem | Root cause | Fix |
|---|---|---|
| API froze entirely during heavy model (TimeXer) training | `ThreadPoolExecutor` + GIL contention from PyTorch's CPU-side autograd overhead starving the asyncio event loop | Switched to `ProcessPoolExecutor` with `spawn` context; verified `/health` latency stayed 10–55ms during a real TimeXer run instead of freezing |
| Experiments stuck "running" forever after a server restart | Process pool that owned the run no longer exists after restart; nothing left to resolve the row | `recover_orphaned_experiments()` startup hook marks stuck pending/running experiments `failed` |
| Classical models scored against the wrong target window | Fitting on `train_series` alone extrapolates from the wrong point in time (off by the length of `val_series`) | `eval_input` smuggled into the `val_series` fit() argument for classical models so their forecast origin lines up exactly with the test window |
| `passlib` bcrypt backend broke | `passlib`'s bcrypt version detection incompatible with bcrypt 5.x | Dropped `passlib`, call the `bcrypt` library directly |
| `/compare` route 422'd | Starlette matches `/{experiment_id}` structurally before trying literal routes registered after it | Registered all comparison routes above the parameterized route |
| Traffic dataset column filtering crashed | `header=None` CSV produces integer column labels, but `selected_columns` are stored as strings everywhere else | Normalize `df.columns` to strings before filtering in `dataset_registry.py` |
| Dark-mode `<select>` dropdown text invisible | Native `<select>` popups fall back to a white background regardless of a transparent parent, while still inheriting light-mode text color | Explicit `bg-white dark:bg-zinc-900` on all `<select>` elements |

## 13. Forward-Compatibility Groundwork

`Experiment.task_type` (default `"forecasting"`) was added as a lightweight discriminator column
ahead of a planned **anomaly detection** feature (see `docs/anomaly_detection_scope.md`): fit on
normal data, forecast the expected "normal" sequence, flag points where the residual exceeds a
threshold. The design reuses the existing single-window forecast pipeline almost entirely
unchanged — no rolling re-prediction loop, no labeled ground-truth dataset, no new metrics module —
and needs only a threshold parameter, a read-time residual computation, and a chart variant.
Not yet built; scoped for a future version.
