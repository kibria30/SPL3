import numpy as np


def build_windows(series: np.ndarray, seq_len: int, pred_len: int):
    """All sliding (input, target) windows fully inside `series`.

    series: (T, n_vars)
    returns: X of shape (num_windows, seq_len, n_vars), Y of shape (num_windows, pred_len, n_vars)
    """
    X, Y = [], []
    T = series.shape[0]
    for start in range(0, T - seq_len - pred_len + 1):
        X.append(series[start:start + seq_len])
        Y.append(series[start + seq_len:start + seq_len + pred_len])
    if len(X) == 0:
        raise ValueError(
            f"Series too short ({T} points) to build any window with seq_len={seq_len} + "
            f"pred_len={pred_len}. Shorten seq_len/pred_len or use a longer series."
        )
    return np.stack(X), np.stack(Y)
