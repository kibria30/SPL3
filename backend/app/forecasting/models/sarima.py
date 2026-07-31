"""SARIMA baseline: one independent SARIMAX(p,d,q)x(P,D,Q,period) model per channel.

This is Tensor-AR's most direct sibling in the "classical, fit-once-and-extrapolate" family
(see models/tensor_ar.py's docstring for why that protocol is used and its limitations vs. the
gradient-trained models) -- but plain univariate ARIMA per channel, with no shared cross-variate
structure, unlike Tensor-AR's CP-decomposition factors.

Like Tensor-AR, this fits on `train_series + val_series` concatenated (not train alone), so its
forecast origin lines up exactly with the start of the test window -- see datasets/base.py.
"""
import warnings

import numpy as np
from statsmodels.tsa.statespace.sarimax import SARIMAX

from models.base import BaseForecaster


class SARIMAForecaster(BaseForecaster):
    name = "SARIMA"

    def __init__(self, period: int, order=(2, 1, 2), seasonal_order_pdq=(1, 0, 1),
                 max_seasonal_period: int = 60):
        """`period` above `max_seasonal_period` disables the seasonal term and falls back to
        plain ARIMA(order): SARIMAX's state-space cost grows with the seasonal period, and
        fitting per-channel with e.g. period=144 (Weather) or 288 (PEMS) gets impractically slow.
        Datasets with a tractable period (Exchange=7, Traffic=24, ILI=52) still get the seasonal
        term.
        """
        self.period = period
        self.order = order
        self.seasonal_order_pdq = seasonal_order_pdq
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
        seasonal_order = (*self.seasonal_order_pdq, self.period) if use_seasonal else (0, 0, 0, 0)

        for i in range(n_vars):
            series_i = history[:, i].astype(np.float64)
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                model = SARIMAX(series_i, order=self.order, seasonal_order=seasonal_order,
                                 enforce_stationarity=False, enforce_invertibility=False)
                fit_result = model.fit(disp=False)
            self._fitted.append(fit_result)

    def predict(self, input_window: np.ndarray) -> np.ndarray:
        forecasts = np.zeros((self._pred_len, self._n_vars), dtype=np.float32)
        for i, fit_result in enumerate(self._fitted):
            forecasts[:, i] = fit_result.forecast(steps=self._pred_len)
        return forecasts

    def num_parameters(self):
        if not self._fitted:
            return None
        return int(sum(len(f.params) for f in self._fitted))  # exact fitted count, summed across channels
