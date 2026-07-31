"""Runs one experiment end to end: loads the dataset, applies period_split(), fits the model
using the family-aware wiring validated in Phase 4 (classical models get eval_input smuggled
into the "val_series" fit() argument so their internal train+val concatenation ends exactly
where test_series begins -- see forecasting/models/tensor_ar.py's docstring and
forecasting/KNOWLEDGE_BASE.md's "Bug #2"), scores the forecast, and persists a Result row plus
actual/predicted .npy files.

Dispatched off the request thread via dispatch_experiment() into a *process* pool, not a thread
pool. A thread pool was tried first and caused exactly the symptom reported against real usage:
running a heavy attention model (TimeXer) froze the whole API, including simple polling GETs on
other experiments. Root cause is the GIL, not the thread pool's size -- torch's CPU-side Python
overhead (autograd bookkeeping, optimizer steps, tensor slicing) holds the GIL for stretches long
enough to starve uvicorn's asyncio event loop thread, so the whole process (all requests, not
just the one experiment) stalls for the training's duration. A ProcessPoolExecutor sidesteps this
entirely -- each worker is a separate interpreter with its own GIL, so heavy training in one
process can't block the main API process from serving other requests. Uses the "spawn" start
method deliberately, not the Linux default "fork": forking after `app.core.db`'s SQLAlchemy
engine/connection pool already exists would let the child inherit live Postgres socket file
descriptors, which corrupts both processes' connections if they're used concurrently. Spawn starts
a fresh interpreter that re-imports and re-creates its own engine instead.
"""
import json
import multiprocessing
import os
import time
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime, timezone

import numpy as np

from app.core.config import settings
from app.core.db import SessionLocal
from app.db_models.dataset import Dataset
from app.db_models.experiment import Experiment, ExperimentStatus
from app.db_models.forecasting_model import ForecastingModel, ModelFamily
from app.db_models.result import Result
from app.services.dataset_registry import load_dataset_dataframe
from app.services.forecasting_bridge import compute_mase_denominators, compute_metrics_table, period_split, summarize
from app.services.model_registry import build_model

_executor = ProcessPoolExecutor(max_workers=2, mp_context=multiprocessing.get_context("spawn"))


def dispatch_experiment(experiment_id: int) -> None:
    _executor.submit(run_experiment, experiment_id)


def run_experiment(experiment_id: int) -> None:
    db = SessionLocal()
    try:
        experiment = db.get(Experiment, experiment_id)
        experiment.status = ExperimentStatus.running
        experiment.started_at = datetime.now(timezone.utc)
        db.commit()

        dataset = db.get(Dataset, experiment.dataset_id)
        model_meta = db.get(ForecastingModel, experiment.model_id)

        df = load_dataset_dataframe(dataset)
        values = df.values.astype(np.float32)
        n_vars = values.shape[1]

        bundle = period_split(
            values, period_len=experiment.period_length, test_periods=experiment.test_periods,
            input_periods=experiment.input_periods, name=dataset.name, feature_names=list(df.columns),
        )

        model = build_model(model_meta.slug, period=experiment.period_length, hyperparams=experiment.hyperparams)

        start = time.time()
        if model_meta.family == ModelFamily.trained:
            val_len = max(1, int(len(bundle.train_series) * experiment.val_ratio))
            train_fit, val = bundle.train_series[:-val_len], bundle.train_series[-val_len:]
            model.fit(train_fit, val, bundle.seq_len, bundle.pred_len, n_vars)
        else:
            # Classical family: eval_input smuggled into the val_series slot -- see module docstring.
            model.fit(bundle.train_series, bundle.eval_input, bundle.seq_len, bundle.pred_len, n_vars)
        fit_time = time.time() - start

        forecast = model.predict(bundle.eval_input)

        history = np.concatenate([bundle.train_series, bundle.eval_input], axis=0)
        mase_denom = compute_mase_denominators(history, experiment.period_length)

        metrics_df = compute_metrics_table(
            {model_meta.name: forecast}, bundle.test_series, bundle.feature_names,
            mase_denom=mase_denom, scaler=bundle.scaler,
        )
        summary_df = summarize(metrics_df)

        exp_dir = settings.storage_dir / "experiments" / str(experiment.id)
        os.makedirs(exp_dir, exist_ok=True)
        actual_path = exp_dir / "actual.npy"
        predicted_path = exp_dir / "predicted.npy"
        np.save(actual_path, bundle.test_series)
        np.save(predicted_path, forecast)

        # pandas' own to_json()/json.loads() round-trip converts numpy scalar types (float64,
        # int64) to plain Python types -- JSONB columns can't serialize numpy types directly.
        metrics_per_feature = json.loads(metrics_df.drop(columns=["Method"]).to_json(orient="records"))
        metrics_avg = json.loads(summary_df.reset_index().drop(columns=["Method"]).to_json(orient="records"))[0]

        result = Result(
            experiment_id=experiment.id,
            training_time_seconds=fit_time,
            num_parameters=model.num_parameters(),
            metrics_per_feature=metrics_per_feature,
            metrics_avg=metrics_avg,
            actual_sequence_path=str(actual_path),
            predicted_sequence_path=str(predicted_path),
        )
        db.add(result)

        experiment.has_train_data = len(bundle.train_series) > 0
        experiment.status = ExperimentStatus.completed
        experiment.completed_at = datetime.now(timezone.utc)
        db.commit()

    except Exception as e:
        db.rollback()
        experiment = db.get(Experiment, experiment_id)
        if experiment is not None:
            experiment.status = ExperimentStatus.failed
            experiment.error_message = str(e)
            experiment.completed_at = datetime.now(timezone.utc)
            db.commit()
    finally:
        db.close()
