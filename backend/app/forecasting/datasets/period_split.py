"""The product's split scheme -- distinct from base.py's standard_split() (70/10/20 ratio).

Test window = the last `test_periods * period_len` rows of a chronologically-ordered series
(always the tail). Within it: the first `input_periods` periods become the model's input
context (`eval_input`); the remaining `(test_periods - input_periods)` periods become
`test_series`, what the forecast is scored against. Everything before the test window is
`train_series` -- possibly empty, if the dataset is short enough that the test window consumes
the whole series (in which case only the classical/no-training-needed models can be run; see
experiment_runner.py's eligibility check).

`period_len` is the dataset's natural cycle length in raw timesteps -- the same concept as
config.py's `tensor_period` (24 for hourly traffic/live-weather, 52 for weekly ILI, etc.).
"""
import numpy as np
from sklearn.preprocessing import StandardScaler

from datasets.base import DatasetBundle


def period_split(values: np.ndarray, period_len: int, test_periods: int, input_periods: int,
                  name: str, feature_names: list = None) -> DatasetBundle:
    if input_periods >= test_periods:
        raise ValueError(
            f"input_periods ({input_periods}) must be < test_periods ({test_periods}) -- "
            "at least one period must be left to forecast and score against."
        )
    if period_len <= 0 or test_periods <= 0 or input_periods <= 0:
        raise ValueError("period_len, test_periods, and input_periods must all be positive.")

    T, n_vars = values.shape
    total_test_len = test_periods * period_len
    seq_len = input_periods * period_len
    pred_len = (test_periods - input_periods) * period_len

    if T < total_test_len:
        raise ValueError(
            f"Dataset '{name}' has only {T} rows -- too short for a {test_periods}-period "
            f"({total_test_len}-row) test window at period_len={period_len}. Lower "
            "test_periods or use a longer series."
        )

    train_raw = values[: T - total_test_len]
    test_window = values[T - total_test_len:]
    eval_input_raw = test_window[:seq_len]
    test_series_raw = test_window[seq_len:]

    # No train data left (test window consumes the whole series): fall back to fitting the
    # scaler on eval_input, the only data available. Non-obvious but accepted -- see plan.
    scaler = StandardScaler()
    scaler.fit(train_raw if len(train_raw) > 0 else eval_input_raw)

    # StandardScaler.transform() rejects a 0-row input outright, so the empty-train-data case
    # is handled explicitly here rather than routed through it.
    if len(train_raw) > 0:
        train_series = scaler.transform(train_raw).astype(np.float32)
    else:
        train_series = train_raw.astype(np.float32)
    eval_input = scaler.transform(eval_input_raw).astype(np.float32)
    test_series = scaler.transform(test_series_raw).astype(np.float32)

    if feature_names is None:
        feature_names = [f"feature_{i}" for i in range(n_vars)]

    return DatasetBundle(
        name=name, n_vars=n_vars, seq_len=seq_len, pred_len=pred_len,
        train_series=train_series,
        val_series=np.empty((0, n_vars), dtype=np.float32),  # unused placeholder -- see module docstring
        eval_input=eval_input, test_series=test_series,
        feature_names=list(feature_names), scaler=scaler,
    )
