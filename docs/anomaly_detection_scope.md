# Anomaly Detection — Future Scope

Status: **not built**. This document is a scoping reference for a future version. It records the
agreed design and the exact, minimal set of changes needed so implementation can pick this up
later without re-deriving the reasoning.

## Design

Fit a model on normal data, forecast the expected "normal" output sequence for a held-out window
(the same single-window forecast the app already produces via `period_split()` + `predict()`),
compare it against the actual observed values, and flag a point as anomalous when the residual
`|actual - predicted|` exceeds a threshold.

This is the standard "forecast-based anomaly detection via residual thresholding" technique. It
is **not** continuous rolling-window re-prediction, and it does **not** need a labeled ground-truth
dataset — there is nothing to classify against, only a threshold to apply to residuals that the
pipeline already computes.

## Why this fits the current architecture almost unchanged

For any experiment today: `period_split()` carves off a held-out test window, a model is fit on
everything before it, `predict(eval_input)` produces one forecast for that window, and `Result`
already stores both sequences (`actual_sequence_path` / `predicted_sequence_path`, both `.npy`
arrays of shape `(pred_len, n_vars)`). An anomaly check is a new way of *interpreting* that same
actual-vs-predicted comparison — not a new prediction workflow.

Reused as-is, no changes needed:
- All 7 models, `fit`/`predict`, `period_split()`, `experiment_runner.py`'s dispatch,
  `eligibility.py`, `model_registry.py` / `dataset_registry.py`, auth, admin, `ExperimentTracker.tsx`.
- `Result.actual_sequence_path` / `predicted_sequence_path` — exactly the two arrays an anomaly
  check needs.
- No new metrics module (no precision/recall/F1/AUC) — this is unsupervised thresholding, not
  classification, so there's nothing to validate a flagged point against except the threshold.

## `task_type` groundwork already in place

`Experiment.task_type` (`String(32)`, default `"forecasting"`, migration
`312199caf682_add_task_type_to_experiments`) exists as a forward-compatible discriminator. Every
current experiment is created with `task_type="forecasting"`; nothing about *running* an
experiment differs today regardless of this field. When anomaly detection is built, it can either:
- stay a **view-level feature** layered on top of ordinary forecasting experiments (no new
  `task_type` value needed — a threshold + a chart on any completed experiment), or
- use `task_type="anomaly_detection"` if it should be filterable/browsable separately in the
  experiments list, or if its creation flow ends up meaningfully different (e.g. requiring the
  user to pick a "normal" period explicitly).

Either path is compatible with the field as it exists now — no further schema fork required to
start.

## What's genuinely new when this gets built

1. **A threshold.** Recommend a statistical threshold derived from the residuals themselves —
   flag a point when `|actual - predicted| > k * std(residuals)` for a user-adjustable `k`
   (3-sigma as the classic default). This reads naturally in the app's existing normalized
   (z-scored) units, since every dataset is already `StandardScaler`-normalized before scoring —
   a threshold in normalized units is directly comparable across every channel/dataset. Fits into
   the existing `Experiment.hyperparams` JSONB (no new column needed), or one new nullable column
   (`anomaly_threshold_k: float | None`) if it should be visibly distinct from a model's own
   hyperparameters.

2. **Read-time flagging.** Compute `is_anomaly` at read time (inside the API route that serves
   chart data) — a cheap `abs(actual - predicted) > threshold` over the already-saved arrays.
   No new persisted array, no run-time compute added to `experiment_runner.py`. A small addition
   to (or sibling of) `GET /experiments/{id}/series` that also returns the threshold and a
   boolean mask per point is the natural home.

3. **Visualization.** A light variant of `frontend/components/ForecastChart.tsx`: same
   actual/predicted lines, plus flagged points marked distinctly wherever the residual mask is
   true. Reuses the SSR guard, dark-mode hook, and feature-pill selector verbatim. Use the
   dataviz skill's fixed status **"critical" red** (`#d03b3b` light) for anomaly markers —
   deliberately distinct from the categorical red already assigned to `timemixer` in
   `frontend/lib/modelColors.ts`, so an anomaly marker is never confusable with a model's series
   color. A summary line ("N of pred_len points flagged") is just `sum(mask)` — no backend work.

## What this does not need

- No rolling/sliding-window re-prediction loop.
- No labeled ground-truth dataset or synthetic anomaly injection.
- No precision/recall/F1/AUC-ROC/AUC-PR evaluator module.
- No new DB table.

## Suggested build order, if/when picked up

1. Add the threshold parameter (hyperparams JSONB key, or one nullable `Experiment` column).
2. Add the read-time residual/mask computation to the series-serving endpoint (or a new sibling
   endpoint).
3. Build the anomaly chart component, reusing `ForecastChart.tsx`'s mechanics.
4. Optionally surface a "view as anomaly detection" toggle on any existing completed experiment's
   results page, rather than a separate creation flow — since nothing about *running* the
   experiment differs, only how its results are displayed.
