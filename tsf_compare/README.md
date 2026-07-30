# tsf_compare

Compares 7 forecasting models across 7 time-series-forecasting benchmarks: **Weather,
Traffic, ILI, Exchange-Rate, PEMS, Beijing PM2.5, Live Weather (Open-Meteo)**.

Two families, deliberately kept distinct (see "A note on model families" below):
- **Classical (fit-once, extrapolate forward):** your **Tensor-AR** (tensor decomposition + AutoReg),
  **SARIMA**, **ETS** (exponential smoothing) — all fit per-channel or via shared factors on all
  pre-test history, then continue forward.
- **Trained (gradient-descent, seq_len → pred_len regressor):** **DLinear**, **iTransformer**,
  **TimeXer**, **TimeMixer** — learn a general windowed mapping from many training examples.

## Layout

```
tsf_compare/
├── main.py              # orchestrates everything — start here
├── config.py             # which datasets/models run, and their hyperparameters
├── models/                # one file per model, all sharing the same fit()/predict() interface
│   ├── base.py
│   ├── tensor_ar.py        \
│   ├── sarima.py            } classical family
│   ├── ets.py               /
│   ├── dlinear.py          \
│   ├── itransformer.py      |
│   ├── timexer.py           } trained family
│   └── timemixer.py        /
├── datasets/              # one file per dataset — each exposes a single load() function
│   ├── base.py            # shared train/val/test split + normalization logic
│   ├── weather.py
│   ├── traffic.py
│   ├── ili.py
│   ├── exchange.py
│   ├── pems.py
│   ├── beijing.py
│   └── live_weather.py
├── services/               # cross-cutting logic used by main.py
│   ├── trainer.py          # shared torch training loop (used by all 4 neural models)
│   ├── evaluator.py        # R²/MSE/MAE/RMSE table + summary
│   └── plotting.py         # forecast-vs-actual plots
├── utils/
│   ├── download.py         # download-if-missing helper
│   └── windows.py          # sliding-window builder
└── outputs/                # results land here after running main.py (git-ignored)
```

## Metrics

Each `results_per_feature.csv` / `summary.csv` reports, per feature and macro-averaged:

| Metric | Scale | Notes |
|---|---|---|
| MSE, MAE, RMSE | Normalized (z-scored) | Standard LTSF benchmark metrics; comparable *within* one dataset+horizon, not across datasets |
| **MASE** | Scale-free (a ratio) | `MAE(forecast) / MAE(in-sample seasonal-naive)`, using each dataset's `tensor_period`. Safe to average across features *and* across datasets — MASE < 1 means "beats seasonal-naive." The one metric here that supports a genuine cross-dataset leaderboard |
| **sMAPE** | Original units (%) | Computed by inverting `bundle.scaler` back to original scale first — sMAPE's denominator is additive, not multiplicative, so it's not safe to compute on z-scored (mean-subtracted) data. Still has the usual sMAPE caveat: a channel crossing exactly zero (e.g. Celsius temperature) can spike a single data point |
| R² | Normalized | Kept for reference, but treat as a diagnostic, not a headline number — it gets erratic on forecasting tasks (a single bad point can send it to -100+) and isn't a metric the LTSF papers themselves report |

`efficiency.csv` (per dataset, one row per model per horizon) reports `Params` (exact fitted
parameter count -- `sum(p.numel())` for the four neural models, the literal CP-decomposition
array sizes for Tensor-AR, `len(fit_result.params)` summed across channels for SARIMA/ETS) and
`FitTimeSeconds` (wall-clock time for that model's `fit()` call). This is the efficiency-vs-accuracy
axis the DLinear paper itself reports (their Table 8) -- worth checking alongside the accuracy
tables, since a much cheaper model within a point of the best MSE is often the more useful result
than the single best MSE.

## Install

```bash
pip install -r requirements.txt
```

## Run

```bash
python main.py                                  # every dataset x every model
python main.py --dataset weather ili             # only these datasets
python main.py --models tensor_ar dlinear         # only these models
python main.py --dataset exchange --models tensor_ar timemixer
```

Each run writes, per dataset, to `outputs/<dataset>/`:
- `horizon_<pred_len>/` — one folder per forecast horizon, each with:
  - `results_per_feature.csv` — R²/MSE/MAE/RMSE/MASE/sMAPE per feature per method, for that horizon
  - `summary.csv` — macro-averaged metrics per method, sorted by MSE, for that horizon
  - one `.png` per plotted feature (actual vs. every method's forecast) for that horizon
- `results_all_horizons.csv` / `summary_all_horizons.csv` — everything above, concatenated with a `Horizon` column
- `efficiency.csv` — `Params` and `FitTimeSeconds` per method per horizon
- `<dataset>_{MSE,MAE,MASE,sMAPE}_vs_horizon.png` — one line per method per metric, showing how
  accuracy degrades as the forecast horizon grows (only produced when a dataset has more than one
  horizon configured)

Each dataset in `config.py` has its own `pred_lens` list (the horizons swept) alongside a single
fixed `seq_len` -- matching how the LTSF papers report results as a curve across horizons rather
than a single number. A model is retrained from scratch per horizon, since `pred_len` is baked
into its output layer.

## Adding a new model

1. Create `models/your_model.py`.
2. If it's a `torch.nn.Module`, subclass `services.trainer.TorchForecaster` and implement
   `build_model(seq_len, pred_len, n_vars)` — you get windowing, batching, and early stopping
   for free (see `models/dlinear.py` for the smallest example).
3. If it isn't gradient-trained (like Tensor-AR), subclass `models.base.BaseForecaster` directly
   and implement `fit()` / `predict()` yourself (see `models/tensor_ar.py`).
4. Register it in `main.py`'s `MODEL_REGISTRY` and add its key to `config.MODELS`.

## Adding a new dataset

1. Create `datasets/your_dataset.py` with a `load(seq_len, pred_len, **kwargs) -> DatasetBundle`
   function. Reuse `datasets.base.standard_split()` for the train/val/test logic — see
   `datasets/exchange.py` for the smallest example.
2. Add an entry to `config.DATASETS` with `seq_len`, `pred_lens` (a list of horizons), and
   `tensor_period` (the period length Tensor-AR should reshape by — e.g. 24 for hourly data
   with daily cycles).

## A note on model families

Tensor-AR, SARIMA, and ETS aren't `seq_len -> pred_len` regressors the way
DLinear/iTransformer/TimeXer/TimeMixer are. Each fits on **all pre-test history**
(`train_series + val_series` concatenated -- see `datasets/base.py`) and continues forward from
wherever that history ends; none of them learn a general mapping from an arbitrary input window
to a forecast the way the four neural models do. `datasets/base.py`'s split is constructed so
end-of-history lines up exactly with the start of the test window, so the single-window backtest
this project runs is apples-to-apples for all seven models. It would **not** stay apples-to-apples
under a rolling-window evaluation (many overlapping test windows) without refitting the three
classical models at every origin -- which is the standard (if expensive) way classical
statistical baselines are backtested, but a bigger lift than for the gradient-trained models.

Within the classical family, Tensor-AR is the more expressive of the three: SARIMA and ETS fit
independently per channel (no cross-variate structure at all), while Tensor-AR's CP decomposition
extracts a shared factor across all channels -- closer to a **Dynamic Factor Model** than to plain
ARIMA/ETS. Comparing Tensor-AR against SARIMA/ETS isolates "does cross-variate structure help
within the classical family"; comparing any of the three against the four neural models isolates
"does learned attention/mixing beat classical decomposition" -- two different, both legitimate,
questions. See each model's docstring (`models/tensor_ar.py`, `models/sarima.py`,
`models/ets.py`) for more.

### Tensor-AR and univariate data

Tensor-AR's CP decomposition needs the feature mode to have size >= 2 -- PARAFAC's SVD-based
initialization can't extract more than one component from a size-1 mode's unfolding, so a
genuinely univariate series (`n_vars == 1`) makes the decomposition degenerate for any
`rank > 1`. None of this project's 5 datasets are univariate, so this doesn't come up in normal
use here, but `models/tensor_ar.py` handles it anyway: when `n_vars == 1`, a constant dummy
column of 1s is appended internally purely so the decomposition has a size-2 feature mode to
factorize. It's zero-variance, so it doesn't bias the real channel's fitted factors, and it's
stripped back out before `predict()` returns -- it never appears in `results_per_feature.csv`
or anywhere else the model gets scored. (SARIMA and ETS don't need this -- they already fit
one independent model per channel, so `n_vars == 1` is trivially fine for them.)

## Notes on data sources

- **Exchange-Rate, Traffic**: downloaded automatically from
  [laiguokun/multivariate-time-series-data](https://github.com/laiguokun/multivariate-time-series-data)
  (the original source used by the LTSF benchmark papers).
- **Weather**: downloaded automatically from the public Jena Climate mirror (14 features @ 10-min,
  2009–2016). This is the same underlying station data the LTSF "Weather" benchmark is built from,
  but not byte-identical to the papers' pre-processed 21-feature `weather.csv` — close enough for
  comparing models against each other, not for reproducing published numbers exactly.
- **ILI**: downloaded automatically from a public mirror of CDC ILINet
  (`national_illness.csv`). Same caveat as Weather — verify column names if you need exact
  reproduction of published results.
- **PEMS**: no stable public HTTP mirror exists (usually distributed as `.npz` via Google Drive in
  the STSGCN/ASTGCN papers' repos) — `datasets/pems.py` expects you to manually download one
  variant (PEMS03/04/07/08) and place it at `data/pems/PEMS08.npz` (or pass `path=...`).
- **Beijing PM2.5**: downloaded automatically from the [UCI Beijing PM2.5 Data
  Set](https://archive.ics.uci.edu/ml/machine-learning-databases/00381/PRSA_data_2010.1.1-2014.12.31.csv)
  (Liang et al. 2015) — hourly `pm2.5`, `DEWP`, `TEMP`, `PRES`, `Iws` at the Beijing US Embassy
  station, 2010–2014. `pm2.5` has ~5% missing values, linearly interpolated by the loader.
- **Live Weather**: fetched live (not a static file) from the [Open-Meteo historical-archive
  API](https://open-meteo.com/en/docs/historical-weather-api) — hourly `temperature_2m`,
  `relative_humidity_2m`, `precipitation`, `wind_speed_10m` for a configurable lat/lon (default:
  Dhaka, Bangladesh), over a rolling ~3-year window ending 2 days before whenever it's run. Cached
  to `data/live_weather/` keyed by (lat, lon, start_date, end_date); pass explicit
  `start_date`/`end_date` via `loader_kwargs` in `config.py` for a reproducible/offline window.
