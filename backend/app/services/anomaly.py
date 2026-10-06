"""Residual-threshold anomaly detection on a saved actual/predicted pair (z-scored space)."""

import numpy as np

DEFAULT_K = 3.0
MAD_TO_STD = 1.4826  # makes MAD a consistent estimator of std for normal residuals


def compute_anomalies(
    actual: np.ndarray, predicted: np.ndarray, mode: str = "auto",
    k: float = DEFAULT_K, threshold: float | None = None,
) -> dict:
    """Flags points where |actual - predicted| exceeds the threshold.

    auto:   per-feature threshold = k * robust_std(actual - predicted); MAD-based so the anomalies
            themselves do not inflate it (falls back to plain std when MAD is 0).
    manual: one absolute threshold (z-scored units) shared by every feature.
    """
    residuals = np.abs(actual - predicted)  # (pred_len, n_vars)

    if mode == "manual":
        if threshold is None or threshold <= 0:
            raise ValueError("Manual mode requires a positive threshold.")
        thresholds = np.full(residuals.shape[1], float(threshold))
    else:
        signed = actual - predicted  # sigma from signed errors; |.| would be half-normal and under-estimate it
        sigma = MAD_TO_STD * np.median(np.abs(signed - np.median(signed, axis=0)), axis=0)
        sigma = np.where(sigma > 0, sigma, signed.std(axis=0))
        thresholds = k * sigma

    flags = residuals > thresholds
    return {
        "mode": mode, "k": k,
        "thresholds": thresholds.tolist(),
        "residuals": residuals.tolist(),
        "flags": flags.tolist(),
        "count": int(flags.sum()),
    }
