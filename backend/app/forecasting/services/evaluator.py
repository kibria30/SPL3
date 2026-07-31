import numpy as np
import pandas as pd
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error, root_mean_squared_error


def compute_mase_denominators(history: np.ndarray, period: int) -> np.ndarray:
    """Per-feature in-sample seasonal-naive MAE: mean(|history[t] - history[t-period]|),
    the denominator of MASE. `history` should be all pre-test data (train_series + val_series
    concatenated -- the same history the classical models fit on), so this reflects genuine
    in-sample difficulty, not a leak from the test window.

    Falls back to period=1 (plain one-step naive) if there isn't enough history for the
    requested period -- the same fallback the M4 competition's own MASE definition uses.
    """
    effective_period = period if 1 < period < len(history) else 1
    diffs = np.abs(history[effective_period:] - history[:-effective_period])
    denom = diffs.mean(axis=0)
    return np.where(denom == 0, 1e-8, denom)  # avoid divide-by-zero on a perfectly flat channel


def _smape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Symmetric MAPE, in percent. Must be computed on original-scale (not z-scored) data --
    see compute_metrics_table's `scaler` argument. Even in original units, a channel that
    crosses zero (e.g. Celsius temperature) can still produce an unstable/inflated value for
    that one point; this is a known sMAPE limitation, not something normalization can fully fix.
    """
    denom = np.abs(y_true) + np.abs(y_pred)
    denom = np.where(denom == 0, 1.0, denom)
    return float(200.0 * np.mean(np.abs(y_pred - y_true) / denom))


def compute_metrics_table(forecasts: dict, actual: np.ndarray, feature_names=None,
                           mase_denom: np.ndarray = None, scaler=None) -> pd.DataFrame:
    """forecasts: {method_name: (pred_len, n_vars) array}. actual: (pred_len, n_vars).
    Returns one row per (feature, method) with R2/MSE/MAE/RMSE, plus MASE if `mase_denom` is
    given (see compute_mase_denominators) and sMAPE if `scaler` is given (an already-fit
    sklearn scaler with .inverse_transform -- typically bundle.scaler from datasets/base.py).

    MSE/MAE/RMSE/MASE are computed in the same units the model was scored in (normalized, by
    convention in this project) -- MASE is a ratio so normalization doesn't bias it. sMAPE is
    NOT scale-invariant (its denominator is additive, not multiplicative), so it's computed on
    `scaler`-inverted, original-scale values instead.
    """
    n_vars = actual.shape[1]
    feature_names = feature_names or [f"feature_{i}" for i in range(n_vars)]

    actual_orig = scaler.inverse_transform(actual) if scaler is not None else None
    forecasts_orig = (
        {m: scaler.inverse_transform(f) for m, f in forecasts.items()} if scaler is not None else None
    )

    rows = []
    for i, fname in enumerate(feature_names):
        y_true = actual[:, i]
        for method, forecast in forecasts.items():
            y_pred = forecast[:, i]
            row = {
                "Feature": fname,
                "Method": method,
                "R2": r2_score(y_true, y_pred),
                "MSE": mean_squared_error(y_true, y_pred),
                "MAE": mean_absolute_error(y_true, y_pred),
                "RMSE": root_mean_squared_error(y_true, y_pred),
            }
            if mase_denom is not None:
                row["MASE"] = mean_absolute_error(y_true, y_pred) / mase_denom[i]
            if scaler is not None:
                row["sMAPE"] = _smape(actual_orig[:, i], forecasts_orig[method][:, i])
            rows.append(row)
    return pd.DataFrame(rows)


def summarize(results_df: pd.DataFrame) -> pd.DataFrame:
    """Macro-average across features, one row per method, sorted by MSE (best first).
    Picks up whichever metric columns are present (MASE/sMAPE are optional) automatically.
    """
    metric_cols = [c for c in results_df.columns if c not in ("Feature", "Method", "Horizon")]
    return results_df.groupby("Method")[metric_cols].mean().sort_values("MSE")
