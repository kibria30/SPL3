"""Orchestrates the comparison: for each dataset in config.DATASETS, sweeps every horizon in
that dataset's `pred_lens`, fits every model in config.MODELS fresh per horizon (pred_len is
baked into each model's output layer, so it can't be reused across horizons), scores them on
the same held-out window, and saves per-horizon results plus combined horizon-curve and
efficiency summaries.

Usage:
    python main.py                                    # every dataset x every model x every horizon
    python main.py --dataset weather ili               # only these datasets
    python main.py --models dlinear tensor_ar           # only these models
    python main.py --dataset exchange --models tensor_ar timemixer
"""
import argparse
import importlib
import os
import time

import numpy as np
import pandas as pd

import config
from services.evaluator import compute_metrics_table, compute_mase_denominators, summarize
from services.plotting import plot_forecasts, plot_horizon_curve

from models.tensor_ar import TensorARForecaster
from models.sarima import SARIMAForecaster
from models.ets import ETSForecaster
from models.dlinear import DLinearForecaster
from models.itransformer import ITransformerForecaster
from models.timexer import TimeXerForecaster
from models.timemixer import TimeMixerForecaster


# Each entry builds a fresh, untrained model for the given dataset config. Tensor-AR/SARIMA/ETS
# need the dataset's period hint; the four neural models share config.TRAIN_KWARGS.
MODEL_REGISTRY = {
    "tensor_ar": lambda ds_cfg: TensorARForecaster(period=ds_cfg["tensor_period"], rank=2),
    "sarima": lambda ds_cfg: SARIMAForecaster(period=ds_cfg["tensor_period"]),
    "ets": lambda ds_cfg: ETSForecaster(period=ds_cfg["tensor_period"]),
    "dlinear": lambda ds_cfg: DLinearForecaster(**config.TRAIN_KWARGS),
    "itransformer": lambda ds_cfg: ITransformerForecaster(**config.TRAIN_KWARGS),
    "timexer": lambda ds_cfg: TimeXerForecaster(**config.TRAIN_KWARGS),
    "timemixer": lambda ds_cfg: TimeMixerForecaster(**config.TRAIN_KWARGS),
}

# Metrics plotted as a horizon curve when a dataset has more than one pred_len configured.
HORIZON_CURVE_METRICS = ["MSE", "MAE", "MASE", "sMAPE"]


def run_horizon(loader, ds_cfg: dict, seq_len: int, pred_len: int, model_keys: list, out_dir: str):
    """Fits every requested model for one horizon, scores them, saves that horizon's plots/CSVs,
    and returns (per-feature results with a Horizon column, list of efficiency records) for the
    caller to aggregate.

    Note: tensor_ar/sarima/ets don't actually need to be refit per horizon -- their fitted
    parameters don't depend on pred_len, only how many steps get forecast forward. They're
    refit here anyway to keep this loop uniform across every model in MODEL_REGISTRY. Correct,
    but wasteful for a multi-horizon sweep with several classical models; worth special-casing
    if runtime becomes a problem (fit once per dataset, forecast max(pred_lens) steps, then
    slice per horizon).
    """
    bundle = loader.load(seq_len=seq_len, pred_len=pred_len, **ds_cfg.get("loader_kwargs", {}))
    print(f"\n=== {bundle.name}  horizon={pred_len} ===  n_vars={bundle.n_vars}  seq_len={seq_len}")

    # In-sample seasonal-naive error, for MASE -- computed once per horizon from the same
    # pre-test history the classical models fit on (see models/tensor_ar.py's docstring).
    history = np.concatenate([bundle.train_series, bundle.val_series], axis=0)
    mase_denom = compute_mase_denominators(history, ds_cfg["tensor_period"])

    forecasts = {}
    efficiency_records = []
    for model_key in model_keys:
        model = MODEL_REGISTRY[model_key](ds_cfg)
        print(f"-- training {model.name} (pred_len={pred_len}) --")

        start = time.time()
        model.fit(bundle.train_series, bundle.val_series, bundle.seq_len, bundle.pred_len, bundle.n_vars)
        fit_time = time.time() - start

        forecasts[model.name] = model.predict(bundle.eval_input)
        efficiency_records.append({
            "Horizon": pred_len,
            "Method": model.name,
            "Params": model.num_parameters(),
            "FitTimeSeconds": round(fit_time, 4),
        })

    results_df = compute_metrics_table(forecasts, bundle.test_series, bundle.feature_names,
                                        mase_denom=mase_denom, scaler=bundle.scaler)
    results_df.insert(0, "Horizon", pred_len)
    summary_df = summarize(results_df)

    horizon_dir = os.path.join(out_dir, f"horizon_{pred_len}")
    os.makedirs(horizon_dir, exist_ok=True)
    results_df.to_csv(os.path.join(horizon_dir, "results_per_feature.csv"), index=False)
    summary_df.to_csv(os.path.join(horizon_dir, "summary.csv"))
    plot_forecasts(bundle.test_series, forecasts, bundle.feature_names, horizon_dir, f"{bundle.name} (h={pred_len})")

    print(f"\n{bundle.name} h={pred_len} summary (sorted by MSE):")
    print(summary_df.to_string())

    return results_df, efficiency_records


def run_dataset(dataset_key: str, model_keys: list) -> tuple:
    ds_cfg = config.DATASETS[dataset_key]
    loader = importlib.import_module(ds_cfg["module"])
    seq_len = ds_cfg["seq_len"]
    pred_lens = ds_cfg["pred_lens"]

    out_dir = os.path.join(config.OUTPUT_DIR, dataset_key)
    os.makedirs(out_dir, exist_ok=True)

    all_results, all_efficiency = [], []
    for pred_len in pred_lens:
        results_df, efficiency_records = run_horizon(loader, ds_cfg, seq_len, pred_len, model_keys, out_dir)
        all_results.append(results_df)
        all_efficiency.extend(efficiency_records)

    combined_results = pd.concat(all_results, ignore_index=True)
    combined_results.to_csv(os.path.join(out_dir, "results_all_horizons.csv"), index=False)

    metric_cols = [c for c in combined_results.columns if c not in ("Feature", "Method", "Horizon")]
    combined_summary = combined_results.groupby(["Horizon", "Method"])[metric_cols].mean().reset_index()
    combined_summary.to_csv(os.path.join(out_dir, "summary_all_horizons.csv"), index=False)

    efficiency_df = pd.DataFrame(all_efficiency)
    efficiency_df.to_csv(os.path.join(out_dir, "efficiency.csv"), index=False)

    if len(pred_lens) > 1:
        for metric in HORIZON_CURVE_METRICS:
            plot_horizon_curve(combined_summary, dataset_key, out_dir, metric=metric)

    print(f"\n=== {dataset_key} combined summary across horizons ===")
    print(combined_summary.to_string(index=False))
    print(f"\n=== {dataset_key} efficiency (params, fit time) ===")
    print(efficiency_df.to_string(index=False))

    return combined_results, combined_summary, efficiency_df


def main():
    parser = argparse.ArgumentParser(description="Compare forecasting models across datasets and horizons.")
    parser.add_argument("--dataset", nargs="+", choices=list(config.DATASETS.keys()),
                         default=list(config.DATASETS.keys()), help="which datasets to run")
    parser.add_argument("--models", nargs="+", choices=config.MODELS,
                         default=config.MODELS, help="which models to run")
    args = parser.parse_args()

    for dataset_key in args.dataset:
        run_dataset(dataset_key, args.models)


if __name__ == "__main__":
    main()
