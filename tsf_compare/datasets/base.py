from dataclasses import dataclass, field
from typing import List, Optional

import numpy as np
from sklearn.preprocessing import StandardScaler


@dataclass
class DatasetBundle:
    """Everything a model needs to fit and be scored, for one dataset."""
    name: str
    n_vars: int
    seq_len: int
    pred_len: int
    train_series: np.ndarray   # (num_train, n_vars) -- for fitting
    val_series: np.ndarray     # (num_val + seq_len, n_vars) -- for early stopping only
    eval_input: np.ndarray     # (seq_len, n_vars) -- the single window fed to predict()
    test_series: np.ndarray    # (pred_len, n_vars) -- ground truth to score against
    feature_names: List[str] = field(default_factory=list)
    scaler: Optional[StandardScaler] = None  # fit on train_series -- lets metrics invert back to original units


def standard_split(values: np.ndarray, seq_len: int, pred_len: int, name: str,
                    feature_names=None, train_ratio: float = 0.7, test_ratio: float = 0.2) -> DatasetBundle:
    """The standard 70/10/20 ratio split with overlapping lookback, used by the Informer /
    Autoformer / DLinear reference implementations for every LTSF benchmark that doesn't have a
    natural calendar split (i.e. everything except the ETT datasets). Z-score normalization is
    fit on the train segment only, then applied to the whole series.

    Evaluation uses a single window: the last `seq_len` points immediately before the test
    segment predict the first `pred_len` points of the true test segment. (The papers average
    over many such windows slid across the whole test split -- see each dataset module's
    docstring / the project README for how to extend this if you want paper-comparable numbers.)
    """
    N = len(values)
    num_train = int(N * train_ratio)
    num_test = int(N * test_ratio)
    num_val = N - num_train - num_test

    border1s = [0, num_train - seq_len, N - num_test - seq_len]
    border2s = [num_train, num_train + num_val, N]

    # border1s[2] intentionally overlaps into the val segment by `seq_len` (the test lookback
    # window) -- that's the standard scheme, not an error. What actually must hold: the train
    # segment must be long enough to leave room for a seq_len lookback, and val/test must each
    # be long enough to contain at least one pred_len-long target.
    if border1s[1] < 0 or border1s[2] < 0:
        raise ValueError(
            f"Dataset '{name}' has only {N} points -- too short for seq_len={seq_len} with a "
            "70/10/20 split. Shorten seq_len or use a longer series."
        )
    if num_val < pred_len or num_test < pred_len:
        raise ValueError(
            f"Dataset '{name}': val/test segments ({num_val}/{num_test} points) are shorter "
            f"than pred_len={pred_len}. Shorten pred_len or use a longer series."
        )

    scaler = StandardScaler()
    scaler.fit(values[border1s[0]:border2s[0]])
    scaled = scaler.transform(values).astype(np.float32)

    train_series = scaled[border1s[0]:border2s[0]]
    val_series = scaled[border1s[1]:border2s[1]]
    test_segment = scaled[border1s[2]:border2s[2]]

    eval_input = test_segment[:seq_len]
    test_series = test_segment[seq_len:seq_len + pred_len]

    n_vars = values.shape[1]
    if feature_names is None:
        feature_names = [f"feature_{i}" for i in range(n_vars)]

    return DatasetBundle(
        name=name, n_vars=n_vars, seq_len=seq_len, pred_len=pred_len,
        train_series=train_series, val_series=val_series,
        eval_input=eval_input, test_series=test_series,
        feature_names=list(feature_names), scaler=scaler,
    )
