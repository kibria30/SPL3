# tsf_compare — Project Knowledge Base

Read this first when picking the project back up (including in Claude Code). It captures not
just *what* the code does but *why* it's built this way — several of the decisions below came
from real bugs found during development, and re-introducing them while "cleaning up" is the
main risk of skipping this file.

---

## 1. What this project is

A framework comparing **7 forecasting models** across **7 time-series-forecasting benchmarks**,
built around one specific model (**Tensor-AR** — a tensor decomposition + AutoReg approach) as
the reference point everything else is compared against.

**Datasets** (priority order, as given by the user): Weather, Traffic, ILI, Exchange-Rate, PEMS.
ETT/Electricity/M4 were explicitly paused/out of scope for this phase. Two more were added later,
carried over from the user's own exploratory notebooks in `Experiment-Passed/`: **Beijing PM2.5**
(`beijing_weather_cast.ipynb`) and **Live Weather / Open-Meteo** (`LiveWeatherCast.ipynb`).

**Models**, split into two families that are *not* directly equivalent (see §3):
- Classical / fit-once-and-extrapolate: **Tensor-AR** (the user's own model), **SARIMA**, **ETS**
- Trained seq2seq regressors: **DLinear**, **iTransformer**, **TimeXer**, **TimeMixer**

## 2. Repository structure

```
tsf_compare/
├── main.py                # orchestrator: loops datasets x horizons x models, saves results
├── config.py               # DATASETS dict (seq_len, pred_lens, tensor_period, loader_kwargs),
│                            #  MODELS list, TRAIN_KWARGS, OUTPUT_DIR -- edit this for routine changes
├── models/
│   ├── base.py              # BaseForecaster ABC: fit(), predict(), num_parameters()
│   ├── tensor_ar.py          # the user's model: CP/PARAFAC decomposition + AutoReg
│   ├── sarima.py             # per-channel SARIMAX, classical sibling of tensor_ar
│   ├── ets.py                # per-channel Holt-Winters, classical sibling of tensor_ar
│   ├── dlinear.py            # decomposition + linear layers (Zeng et al. 2023)
│   ├── itransformer.py       # inverted variate-as-token attention (Liu et al. 2024)
│   ├── timexer.py            # patch + global-token cross-attention (Wang et al. 2024)
│   └── timemixer.py          # multi-scale decomposition mixing (Wang et al. 2024)
├── datasets/
│   ├── base.py               # DatasetBundle dataclass + standard_split() (70/10/20 ratio split,
│   │                          #  z-score norm, single-window eval construction)
│   ├── weather.py, traffic.py, ili.py, exchange.py, pems.py
│   ├── beijing.py             # Beijing PM2.5, hourly, UCI mirror, auto-downloaded
│   ├── live_weather.py        # Open-Meteo archive API, fetched live (not a static file)
├── services/
│   ├── trainer.py            # TorchForecaster: shared fit/predict for all 4 neural models
│   ├── evaluator.py          # compute_metrics_table(), compute_mase_denominators(), summarize()
│   └── plotting.py           # plot_forecasts(), plot_horizon_curve()
├── utils/
│   ├── download.py           # download_if_missing()
│   └── windows.py            # build_windows() sliding-window builder
├── data/                     # downloaded datasets land here (gitignored)
├── outputs/                  # results land here after running main.py (gitignored)
├── README.md                 # user-facing docs: install/run/output format/model-family notes
└── requirements.txt
```

`README.md` is the user-facing reference (install/run instructions, output file formats, the
model-family distinction, data source notes). This file (`KNOWLEDGE_BASE.md`) is the
development-history / rationale layer underneath it — read both.

## 3. The central design decision: two model families

This distinction shaped almost every other design choice in the project, so it's worth
understanding before touching anything.

**Trained family** (DLinear, iTransformer, TimeXer, TimeMixer): learn a general mapping
`f(any seq_len window) -> pred_len forecast` via gradient descent on many sliding-window
examples. Once trained, any window can be fed in.

**Classical family** (Tensor-AR, SARIMA, ETS): fit once on **all pre-test history** and
extrapolate forward from wherever that history ends. They cannot answer "forecast from *this*
arbitrary window" — only "continue from *my* fitted state." This is the same category as
ARIMA/ETS in general, not the same category as the neural models, even though they produce a
directly comparable number in this project's single-window backtest.

Practical consequences of this baked into the code:
- `datasets/base.py`'s split is constructed so that `train_series + val_series` ends **exactly**
  where the test window begins (`num_train + num_val == N - num_test`). This is what makes the
  single-window backtest fair for the classical family — see §6 and §8 (bug #1).
- Tensor-AR/SARIMA/ETS all fit on `train_series + val_series` concatenated in their `fit()`
  methods, not `train_series` alone. There's no "held-out validation" concept for them (no
  hyperparameters being tuned against val loss) — using all pre-test history is the correct
  analogue of a classical statistical backtest.
- Extending this project to **rolling-window evaluation** (many overlapping test windows, which
  is what the LTSF papers actually report) is a bigger lift for the classical family, since
  they'd need to be refit at every origin. The trained models just run forward on each window
  for free. **This has not been implemented** — current evaluation is single-window only.
- Within the classical family, Tensor-AR is more expressive than SARIMA/ETS: it extracts a
  shared cross-variate factor via CP decomposition (closer to a **Dynamic Factor Model**), while
  SARIMA/ETS fit independently per channel with no cross-variate structure at all.

## 4. Models — implementation notes

All four neural models are **self-contained reimplementations**, not copies of the uploaded
reference files (`DLinear.py`, `TimeMixer.py`, `TimeXer.py`, `iTransformer.py`) — those depend
on a shared `layers/` package (`Embed`, `SelfAttention_Family`, `Transformer_EncDec`,
`Autoformer_EncDec`, `StandardNorm`) that isn't installed in this project. Each reimplementation
preserves the defining architectural idea of its paper but is sized down and dependency-free:

- **DLinear**: `series_decomp` (moving-average trend/seasonal split) + one `Linear(seq_len,
  pred_len)` per component, summed. Multivariate version shares weights across channels
  (`individual=False`, the paper's default).
- **iTransformer**: each variate's whole series becomes one token via `Linear(seq_len,
  d_model)`; `nn.TransformerEncoder` attends *across variates*, not across time. Per-instance
  mean/std normalization wraps it (Non-stationary Transformer trick).
- **TimeXer**: patch-embeds each variate + a learned global token; self-attention over
  patches+token; the global token then cross-attends to inverted (whole-series) embeddings of
  *all* variates. Flatten head `(patch_num+1)*d_model -> pred_len`.
- **TimeMixer**: decomposes at multiple down-sampled scales; seasonal mixed bottom-up
  (fine→coarse), trend mixed top-down (coarse→fine); per-scale predictors summed. Channel-
  independent (each variate is its own batch item, like DLinear).

All four share `services/trainer.py`'s `TorchForecaster`: sliding-window construction via
`utils/windows.py`, mini-batch Adam training, early stopping on val loss. Each model file only
implements `build_model(seq_len, pred_len, n_vars)`.

**Tensor-AR** (`models/tensor_ar.py`): reshapes history into `(PERIOD, TIME, FEATURES)`, fits
rank-R PARAFAC/CP decomposition, forecasts each latent "day factor" forward with
`AutoReg(lags=1)`, reconstructs via outer products. Handles univariate input (`n_vars == 1`) by
appending a constant dummy column before decomposition — see §8, bug #3.

**SARIMA / ETS** (`models/sarima.py`, `models/ets.py`): one independent `SARIMAX`/
`ExponentialSmoothing` per channel. Both auto-disable the seasonal term above
`max_seasonal_period=60` (default) and fall back to non-seasonal, since state-space cost scales
with the seasonal period and a 144- or 288-length cycle per channel (Weather, PEMS) would be
impractically slow to fit. ETS is additive-only (`trend="add"`, `seasonal="add"`) because the
z-scored data can go negative, and multiplicative Holt-Winters requires strictly positive input.

## 5. Datasets — sources and quirks

All five loaders live in `datasets/`, each exposing `load(seq_len, pred_len, **kwargs) ->
DatasetBundle`, and reuse `datasets/base.py`'s `standard_split()`.

| Dataset | Source | Notes |
|---|---|---|
| **Weather** | Jena Climate mirror (`storage.googleapis.com/tensorflow/...`), auto-downloaded | 14 features @ 10-min, 2009-2016. **Not** byte-identical to the LTSF papers' 21-feature `weather.csv` — same underlying station, different preprocessing. Fine for comparing models to each other, not for reproducing published numbers |
| **Traffic** | `laiguokun/multivariate-time-series-data` (original LSTNet source), auto-downloaded | 862 sensors, hourly. `max_vars=50` in config by default — full 862-variate attention/CP decomposition gets expensive |
| **ILI** | Public CDC ILINet mirror (`scalation/data`), auto-downloaded | Smallest dataset (966 rows weekly). Verify column names if exact reproduction of published results matters |
| **Exchange-Rate** | `laiguokun/multivariate-time-series-data`, auto-downloaded | 8 FX series, daily, 1990-2016. Near-random-walk — deliberately the "tough test" dataset (weak periodicity; in the DLinear paper, naive repeat-last-value beats every Transformer here) |
| **PEMS** | **No stable public mirror** — `datasets/pems.py` raises a clear `FileNotFoundError` with instructions if the `.npz` isn't found locally | Expects `data/pems/PEMS08.npz` (or `path=...`) with a `data` array `(timesteps, sensors, features)`; only the flow channel (index 0) is used. Evaluated short-horizon (`pred_lens=[12]`) unlike the other four — this is standard in the literature, not a project-specific choice |
| **Beijing PM2.5** | UCI Beijing PM2.5 Data Set (Liang et al. 2015), auto-downloaded | Hourly, 2010-2014, Beijing US Embassy station. Columns kept: `pm2.5`, `DEWP`, `TEMP`, `PRES`, `Iws` — same set the user's `beijing_weather_cast.ipynb` uses, minus categorical `cbwd` and low-information `Is`/`Ir`. `pm2.5` has ~5% missing values (unlike the notebook, which drops the column to dodge this, the loader linearly interpolates and keeps it — it's the headline variable). Kept at native hourly granularity, not resampled to daily like the notebook does |
| **Live Weather** | Open-Meteo historical-archive API (`archive-api.open-meteo.com`), fetched live | Hourly `temperature_2m`, `relative_humidity_2m`, `precipitation`, `wind_speed_10m` for a configurable lat/lon (default Dhaka, Bangladesh — same as `LiveWeatherCast.ipynb`), rolling ~3-year window ending 2 days before whenever `main.py` runs. Only loader that isn't a fixed file — its date range moves forward with the calendar, so results aren't bit-for-bit reproducible run-to-run unless `start_date`/`end_date` are pinned via `loader_kwargs`. Cached to `data/live_weather/` keyed by (lat, lon, start_date, end_date) so same-day reruns don't re-hit the API |

`config.DATASETS[key]["tensor_period"]` is the seasonal period Tensor-AR/SARIMA/ETS reshape by:
Weather=144 (daily @ 10-min), Traffic=24 (daily @ hourly), ILI=52 (yearly @ weekly),
Exchange=7 (weak weekly), PEMS=288 (daily @ 5-min), Beijing=24 (daily @ hourly),
Live Weather=24 (daily @ hourly).

## 6. Evaluation protocol

`datasets/base.py:standard_split()` implements the **standard 70/10/20 ratio split with
overlapping lookback** used by Informer/Autoformer/DLinear reference implementations for every
LTSF benchmark without a natural calendar split (everything except ETT, which isn't in this
project).

```
border1s = [0, num_train - seq_len, N - num_test - seq_len]
border2s = [num_train, num_train + num_val, N]
```

`border1s[2] < border2s[1]` (the test lookback overlapping into val by `seq_len`) is
**intentional**, not a bug — see §8, bug #1 for the history of getting this validation check
right.

Z-score normalization (`sklearn.preprocessing.StandardScaler`) is fit on the train segment only,
then applied to the whole series. The fitted scaler is stored on `DatasetBundle.scaler` so
metrics can invert back to original units when needed (sMAPE — see §7).

**Evaluation is single-window**: the last `seq_len` points immediately before the test segment
predict the first `pred_len` points of the true test segment — one forecast, scored once. The
LTSF papers report an average over *many* overlapping windows slid across the whole test split;
this project does not do that yet (see §9, "not yet done").

## 7. Metrics

Computed in `services/evaluator.py`, written to `results_per_feature.csv` / `summary.csv` per
horizon, plus `results_all_horizons.csv` / `summary_all_horizons.csv` combined across horizons.

| Metric | Scale | Purpose |
|---|---|---|
| MSE, MAE, RMSE | Normalized (z-scored) | Standard LTSF metrics; comparable within one dataset+horizon only |
| **MASE** | Scale-free (ratio) | `MAE(forecast) / MAE(in-sample seasonal-naive)`, using `tensor_period`. The only metric here safe to average across features *and* datasets — enables a genuine cross-dataset leaderboard. Denominator computed by `compute_mase_denominators()` from `train_series + val_series` (same history the classical models fit on) |
| **sMAPE** | Original units (%) | Computed via `bundle.scaler.inverse_transform()` first — sMAPE's additive denominator isn't safe on z-scored (mean-near-zero) data. Still has the standard sMAPE caveat: a channel crossing exactly zero (e.g. Celsius) can spike a single point |
| R² | Normalized | Kept as a diagnostic only — gets erratic on forecasting tasks (a single bad horizon can send it to -100+), and isn't reported in the LTSF papers themselves |

`efficiency.csv` (per dataset, one row per model per horizon): `Params` (exact fitted parameter
count — `sum(p.numel())` for the 4 neural models, literal CP-factor array sizes for Tensor-AR,
`len(fit_result.params)` summed across channels for SARIMA/ETS) and `FitTimeSeconds` (wall-clock
`fit()` time). This is the accuracy-vs-efficiency axis the DLinear paper's own Table 8 reports.

**Known inefficiency, left as-is deliberately**: `tensor_ar`/`sarima`/`ets`'s fitted parameters
don't actually depend on `pred_len`, only how far forward they extrapolate — but `main.py`
refits them fresh per horizon anyway, to keep the orchestration loop uniform across all 7
models. Correct, but wasteful for a multi-horizon sweep. Documented in `main.py`'s
`run_horizon()` docstring as a candidate optimization if runtime becomes a problem.

## 8. Bugs found and fixed (chronological — read this before "fixing" something similar)

**Bug #1 — split validation false positive.** Early version of `standard_split()` raised a
`ValueError` whenever `border1s[2] < border2s[1]`, treating the test/val overlap as invalid.
That overlap (test's lookback window reusing the tail of val) is the *intended* standard scheme,
not an error. Fixed by checking only what actually must hold: `border1s[1] >= 0`, `border1s[2]
>= 0`, and `num_val`/`num_test` each `>= pred_len`. Caught by a synthetic functional test across
all 5 dataset size/horizon profiles before it ever reached real data.

**Bug #2 — Tensor-AR calendar misalignment (the important one).** Original `TensorARForecaster`
fit only on `train_series` and extrapolated `pred_len` steps from **end of train**. But
`eval_input`/`test_series` sit much later in calendar time — after the entire validation segment
too (hundreds of points for most datasets). Tensor-AR was silently forecasting the wrong slice
of time and being scored against a target it was never pointed at. Fixed by fitting on
`train_series + val_series` concatenated instead. Verified **exactly** (not approximately) that
`num_train + num_val == N - num_test` for all 5 dataset profiles — i.e. end of (train+val)
lands precisely at the start of the test window. This fix is now baked into SARIMA/ETS too
(they were added after this bug was found, so they never had it).

**Bug #3 — PARAFAC degenerates on univariate input.** `tensorly`'s PARAFAC uses SVD-based
initialization; a feature mode of size 1 only has rank-1 unfolding, so requesting `rank > 1`
fails/degenerates. Doesn't affect this project's 5 datasets (all multivariate) but would break
Tensor-AR on any single-channel series. Fixed (matching the user's own reference notebook's
workaround) by appending a constant dummy column of 1s internally when `n_vars == 1`, purely so
the feature mode has size >= 2; the dummy is sliced back out before `predict()` returns and
never appears in anything the model is scored on.

## 9. What's implemented vs. not yet done

**Implemented and validated** (see §10 for validation caveats): all 7 dataset loaders, all 7
models, the full `main.py` horizon-sweep orchestration, all metrics (MSE/MAE/RMSE/R²/MASE/
sMAPE), the efficiency table, per-horizon and cross-horizon plots.

**Not yet done / explicitly deferred:**
- **Rolling-window evaluation.** Current eval is a single window per dataset+horizon. Extending
  to many overlapping windows (matching the papers' protocol) is straightforward for the 4
  neural models (`utils/windows.py:build_windows()` already generalizes) but requires refitting
  the 3 classical models at every origin — a real design decision, not just more code.
- **PEMS has never been run** — no dataset file has been obtained/placed yet (no stable public
  mirror exists; needs manual download per `datasets/pems.py`'s error message).
- **Live Weather isn't run-to-run reproducible by default** — its date window moves forward with
  the calendar (see §5), unlike every other loader. Fine for routine comparison runs; pin
  `start_date`/`end_date` in `config.py`'s `loader_kwargs` if you need a frozen benchmark.
- **No actual end-to-end run has happened anywhere.** Every validation so far (see §10) used
  stubbed `torch`/`tensorly`/`statsmodels` in a sandbox with no internet access. The real
  `pip install -r requirements.txt && python main.py` has not been executed yet.
- Candidate models discussed but not added: PatchTST, NLinear, TSMixer, TimesNet, N-HiTS/
  N-BEATS, Autoformer/FEDformer, Seasonal-Naive baseline. (The user capped the roster at 5, then
  extended to 7 with SARIMA/ETS — these remain candidates if the roster grows again.)

## 10. Validation status — read before trusting a "this works" claim

Every check performed on this project so far was done in a sandboxed environment **with no
`torch`, `tensorly`, or `statsmodels` installed, and no internet access**. What was actually
verified:
- Every file byte-compiles (`python -m py_compile`) and every cross-file import/class name
  resolves correctly.
- `datasets/base.py:standard_split()` was functionally tested with real `numpy`/`pandas`/
  `sklearn` (all available in-sandbox) across all 5 dataset size/horizon profiles.
- `services/evaluator.py` and `services/plotting.py` were functionally tested with synthetic
  data (real sklearn/matplotlib).
- The full `main.py` orchestration loop (horizon sweep, CSV aggregation, plotting, efficiency
  tracking) was tested end-to-end using **stub model classes** implementing `BaseForecaster`
  (no torch/tensorly/statsmodels needed) standing in for the real models.
- `TensorARForecaster`/`SARIMAForecaster`/`ETSForecaster`'s actual logic (not stubs) was tested
  with `tensorly.decomposition.parafac` and `statsmodels`'s `SARIMAX`/`ExponentialSmoothing`/
  `AutoReg` **replaced by hand-written fake classes** matching their real interfaces closely
  enough to exercise the shape/wiring logic (including the univariate dummy-column path).
- The four neural models' actual `torch.nn.Module` forward passes have **never executed
  anywhere** — their tensor reshape/permute logic was hand-traced for correctness but not
  run.
- Download URLs for Weather/Traffic/Exchange/ILI were confirmed to exist via web search, but
  the actual downloads were never executed (no sandbox internet access).

**First thing to do with Claude Code**: `pip install -r requirements.txt`, then a fast smoke
test before the full sweep — e.g. `python main.py --dataset exchange --models tensor_ar dlinear`
(Exchange is smallest of the 4 long-horizon datasets; skips PEMS, which needs a manually-placed
file first).

## 11. Key decisions log (why things are the way they are, briefly)

- **Config-driven, not code-driven**: `config.py` centralizes which datasets/models run and
  their hyperparameters specifically so routine changes (add a horizon, subsample a dataset,
  drop a model from a run) don't require touching `main.py`.
- **`pred_lens` is a list per dataset**, not a single value — added specifically to match how
  the LTSF papers report a curve across horizons, not one number. A model is retrained fresh per
  horizon since `pred_len` is baked into its output layer.
- **`num_parameters()` returns exact counts, not estimates**, wherever the underlying library
  exposes them (`torch` `.numel()`, `statsmodels` `.params`) — deliberately avoided an
  approximate/estimated parameter count for the classical models.
- **sMAPE requires the scaler; MASE doesn't** — because MASE is a ratio (scale-invariant) but
  sMAPE's denominator is additive (not scale-invariant, and specifically broken by mean-
  subtraction), this is not an inconsistency, it's a real difference in what each metric needs.
- **Traffic and PEMS default to `max_vars=50`** — both have far more channels (862 and
  hundreds respectively) than the other 3 datasets; full-width attention (iTransformer/TimeXer)
  and full CP decomposition (Tensor-AR) get expensive fast. Subsample is a config knob, not a
  hard limit — set `max_vars=None` in `config.py`'s `loader_kwargs` for the full dataset.
