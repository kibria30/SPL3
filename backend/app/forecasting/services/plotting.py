import os
import re

import matplotlib
matplotlib.use("Agg")  # headless-safe: works when run from the CLI, no display required
import matplotlib.pyplot as plt


def _safe_filename(text: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", text)


def plot_forecasts(actual, forecasts: dict, feature_names, out_dir: str, dataset_name: str,
                    max_features: int = 5) -> None:
    """Saves one PNG per plotted feature: actual vs. every method's forecast.
    `max_features` caps how many feature plots are generated (some datasets, e.g. Traffic, have
    dozens of channels -- plotting all of them isn't useful for a quick look).
    """
    os.makedirs(out_dir, exist_ok=True)
    n_show = min(max_features, actual.shape[1])

    for i in range(n_show):
        plt.figure(figsize=(12, 4))
        plt.plot(actual[:, i], "k-", lw=2, label="Actual")
        for method, forecast in forecasts.items():
            plt.plot(forecast[:, i], "--", lw=1.2, label=method)
        plt.title(f"{dataset_name} — {feature_names[i]}")
        plt.xlabel("Time steps into test horizon")
        plt.legend(fontsize=8, ncol=2)
        plt.tight_layout()

        fname = _safe_filename(f"{dataset_name}_{feature_names[i]}") + ".png"
        plt.savefig(os.path.join(out_dir, fname), dpi=120)
        plt.close()

    print(f"Saved {n_show} plot(s) to {out_dir}")


def plot_horizon_curve(horizon_summary, dataset_name: str, out_dir: str, metric: str = "MSE") -> None:
    """horizon_summary: a DataFrame with columns [Horizon, Method, R2, MSE, MAE, RMSE] (long
    format, one row per horizon per method -- see main.py's combined_summary). Plots `metric`
    vs. horizon, one line per method, matching how the LTSF papers show model degradation as
    the forecast horizon grows (e.g. DLinear paper Figure 4-style curves).
    """
    os.makedirs(out_dir, exist_ok=True)

    plt.figure(figsize=(8, 5))
    for method, group in horizon_summary.groupby("Method"):
        group = group.sort_values("Horizon")
        plt.plot(group["Horizon"], group[metric], marker="o", label=method)
    plt.xlabel("Forecast horizon (pred_len)")
    plt.ylabel(f"{metric} (macro-avg across features)")
    plt.title(f"{dataset_name} — {metric} vs. horizon")
    plt.legend(fontsize=8)
    plt.tight_layout()

    fname = _safe_filename(f"{dataset_name}_{metric}_vs_horizon") + ".png"
    path = os.path.join(out_dir, fname)
    plt.savefig(path, dpi=120)
    plt.close()

    print(f"Saved horizon curve to {path}")
