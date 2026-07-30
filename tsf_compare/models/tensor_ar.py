import math

import numpy as np
from tensorly.decomposition import parafac
from statsmodels.tsa.ar_model import AutoReg

from models.base import BaseForecaster


class TensorARForecaster(BaseForecaster):
    """Reshapes the pre-test history into a (PERIOD, TIME, FEATURES) tensor, fits a rank-R
    PARAFAC/CP decomposition, forecasts each latent "day factor" forward with AutoReg(lags=1),
    and reconstructs a forecast tensor from the extrapolated factors.

    Unlike the four neural models, this doesn't train via gradient descent and doesn't
    condition its forecast on an arbitrary input window -- it always continues forward from
    the data it was fit on. `predict()`'s `input_window` argument is accepted (for interface
    compatibility with BaseForecaster) but not used.

    Fits on `train_series` AND `val_series` concatenated (not train alone). This matters: with
    datasets/base.py's standard split, val_series ends exactly where the test window begins, so
    extrapolating forward from the end of (train + val) lands the forecast at exactly the same
    calendar position as `eval_input`/`test_series` for the other four models. Fitting on
    train_series alone would extrapolate from the wrong point in time -- off by the length of
    val_series (hundreds of points for most of these datasets) -- and silently score a forecast
    against a target it was never actually pointed at. There's no "held-out validation" concept
    that applies to Tensor-AR the way it does for the gradient-trained models (it has no
    hyperparameters being tuned against val loss), so using all pre-test history here is the
    correct analogue of what a classical statistical forecast (ARIMA, ETS, etc.) would do in a
    backtest: fit on everything known up to the forecast origin.

    Univariate history (n_vars == 1): PARAFAC's SVD-based initialization can't extract more
    than one component from a size-1 mode's unfolding, so a feature dimension of exactly 1
    makes the CP decomposition degenerate whenever `rank > 1`. Since none of this project's 5
    datasets are univariate, this only matters if you point Tensor-AR at a single-channel
    series directly. The fix (matching the standard workaround -- e.g. adding a constant
    dummy feature column before decomposing): a constant column of 1s is appended internally
    before the tensor decomposition, purely so the feature mode has size >= 2. It carries zero
    variance, so it doesn't bias the fitted factors for the real channel(s), and it's dropped
    again before `predict()` returns -- it never appears in anything the model is scored on.
    """

    name = "Tensor-AR"

    def __init__(self, period: int, rank: int = 2, ar_lags: int = 1):
        self.period = period
        self.rank = rank
        self.ar_lags = ar_lags
        self._weights = None
        self._day_factors = None
        self._time_factors = None
        self._feature_factors = None
        self._real_n_vars = None
        self._pred_len = None

    def fit(self, train_series: np.ndarray, val_series: np.ndarray,
            seq_len: int, pred_len: int, n_vars: int) -> None:
        history = np.concatenate([train_series, val_series], axis=0)
        self._real_n_vars = n_vars
        self._pred_len = pred_len

        # See class docstring: PARAFAC needs the feature mode to have size >= 2.
        if n_vars == 1:
            dummy = np.ones((len(history), 1), dtype=history.dtype)
            history_for_decomp = np.concatenate([history, dummy], axis=1)
        else:
            history_for_decomp = history
        decomp_n_vars = history_for_decomp.shape[1]

        usable_len = (len(history_for_decomp) // self.period) * self.period
        if usable_len == 0:
            raise ValueError(
                f"Pre-test history has only {len(history_for_decomp)} points, too short for "
                f"period={self.period}. Lower `tensor_period` for this dataset in config.py."
            )
        tensor = history_for_decomp[-usable_len:].reshape(-1, self.period, decomp_n_vars).astype(np.float64)

        weights, factors = parafac(tensor, rank=self.rank, normalize_factors=True)
        self._day_factors, self._time_factors, self._feature_factors = factors
        self._weights = weights

    def predict(self, input_window: np.ndarray) -> np.ndarray:
        forecast_periods = math.ceil(self._pred_len / self.period)
        forecast_day_factors = np.zeros((forecast_periods, self.rank))

        for r in range(self.rank):
            series_r = self._day_factors[:, r]
            ar_fit = AutoReg(series_r, lags=self.ar_lags, old_names=False).fit()
            forecast_day_factors[:, r] = ar_fit.forecast(steps=forecast_periods)

        # Only reconstruct the real channel(s) -- self._feature_factors[:self._real_n_vars, :]
        # silently drops the dummy column's row (it's always appended last) if one was added.
        forecast_tensor = np.zeros((forecast_periods, self.period, self._real_n_vars))
        for i in range(forecast_periods):
            for r in range(self.rank):
                forecast_tensor[i, :, :] += self._weights[r] * np.outer(
                    forecast_day_factors[i, r] * self._time_factors[:, r],
                    self._feature_factors[:self._real_n_vars, r],
                )

        return forecast_tensor.reshape(-1, self._real_n_vars)[: self._pred_len].astype(np.float32)

    def num_parameters(self):
        if self._weights is None:
            return None
        # Includes the dummy feature's row in feature_factors when n_vars == 1 (a handful of
        # extra scalars) -- not worth the extra bookkeeping to exclude for an efficiency metric.
        return int(
            self._weights.size + self._day_factors.size
            + self._time_factors.size + self._feature_factors.size
        )
