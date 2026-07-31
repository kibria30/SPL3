"""ETS (Exponential Smoothing / Holt-Winters) baseline: one independent model per channel.

Tensor-AR's other sibling in the "classical, fit-once-and-extrapolate" family (see
models/tensor_ar.py's docstring) -- smoothing/state-space structure instead of ARMA structure,
and like SARIMA, no shared cross-variate structure (unlike Tensor-AR's CP-decomposition factors).

Like Tensor-AR and SARIMA, fits on `train_series + val_series` concatenated so its forecast
origin lines up exactly with the start of the test window -- see datasets/base.py.
"""
import warnings

import numpy as np
from statsmodels.tsa.holtwinters import ExponentialSmoothing

from models.base import BaseForecaster


class ETSForecaster(BaseForecaster):
    name = "ETS"

    def __init__(self, period: int, trend: str = "add", seasonal: str = "add",
                 max_seasonal_period: int = 60):
        """Additive trend/seasonal only: the input series are z-scored (can go negative), and
        multiplicative Holt-Winters components require strictly positive data. `period` above
        `max_seasonal_period` disables the seasonal term (same rationale as SARIMA -- fitting a
        144- or 288-length seasonal cycle per channel gets impractically slow), falling back to
        trend-only exponential smoothing.
        """
        self.period = period
        self.trend = trend
        self.seasonal = seasonal
        self.max_seasonal_period = max_seasonal_period
        self._fitted = []
        self._pred_len = None
        self._n_vars = None

    def fit(self, train_series: np.ndarray, val_series: np.ndarray,
            seq_len: int, pred_len: int, n_vars: int) -> None:
        history = np.concatenate([train_series, val_series], axis=0)
        self._pred_len = pred_len
        self._n_vars = n_vars
        self._fitted = []

        use_seasonal = 1 < self.period <= self.max_seasonal_period
        min_len_for_seasonal = 2 * self.period if use_seasonal else 0

        for i in range(n_vars):
            series_i = history[:, i].astype(np.float64)
            fit_seasonal = self.seasonal if (use_seasonal and len(series_i) >= min_len_for_seasonal) else None
            seasonal_periods = self.period if fit_seasonal is not None else None

            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                model = ExponentialSmoothing(
                    series_i, trend=self.trend, seasonal=fit_seasonal,
                    seasonal_periods=seasonal_periods, initialization_method="estimated",
                )
                fit_result = model.fit()
            self._fitted.append(fit_result)

    def predict(self, input_window: np.ndarray) -> np.ndarray:
        forecasts = np.zeros((self._pred_len, self._n_vars), dtype=np.float32)
        for i, fit_result in enumerate(self._fitted):
            forecasts[:, i] = fit_result.forecast(self._pred_len)
        return forecasts

    def num_parameters(self):
        if not self._fitted:
            return None
        return int(sum(len(f.params) for f in self._fitted))  # exact fitted count, summed across channels
