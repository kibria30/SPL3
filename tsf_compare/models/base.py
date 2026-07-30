from abc import ABC, abstractmethod
from typing import Optional

import numpy as np


class BaseForecaster(ABC):
    """The one interface every model in this project implements, so main.py can treat
    Tensor-AR and the four neural models identically.
    """

    name: str = "base"

    @abstractmethod
    def fit(self, train_series: np.ndarray, val_series: np.ndarray,
            seq_len: int, pred_len: int, n_vars: int) -> None:
        """train_series / val_series: (T, n_vars) arrays, already normalized.
        val_series is for early stopping / model selection only -- never for fitting weights.
        """
        raise NotImplementedError

    @abstractmethod
    def predict(self, input_window: np.ndarray) -> np.ndarray:
        """input_window: (seq_len, n_vars). Returns a forecast of shape (pred_len, n_vars)."""
        raise NotImplementedError

    def num_parameters(self) -> Optional[int]:
        """Count of fitted numeric parameters, for the efficiency comparison in main.py.
        Only meaningful after fit(). Returns None if a subclass doesn't override this (rather
        than 0, so it's distinguishable from "genuinely zero parameters" in reports).
        Default: not implemented.
        """
        return None
