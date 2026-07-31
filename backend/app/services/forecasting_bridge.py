"""The one file that knows app/forecasting/ (a copy of tsf_compare's library, see
app/forecasting/ itself) uses bare, non-package-qualified imports (`import config`,
`from models.tensor_ar import ...`). Every other backend module imports from here, never
reaches into `app.forecasting.*` directly, so this sys.path hack stays contained to one file.
"""
import os
import sys

_FORECASTING_DIR = os.path.join(os.path.dirname(__file__), "..", "forecasting")
_FORECASTING_DIR = os.path.abspath(_FORECASTING_DIR)
if _FORECASTING_DIR not in sys.path:
    sys.path.insert(0, _FORECASTING_DIR)

from models.base import BaseForecaster  # noqa: E402
from models.tensor_ar import TensorARForecaster  # noqa: E402
from models.sarima import SARIMAForecaster  # noqa: E402
from models.ets import ETSForecaster  # noqa: E402
from models.dlinear import DLinearForecaster  # noqa: E402
from models.itransformer import ITransformerForecaster  # noqa: E402
from models.timexer import TimeXerForecaster  # noqa: E402
from models.timemixer import TimeMixerForecaster  # noqa: E402

from datasets.base import DatasetBundle, standard_split  # noqa: E402
from datasets.period_split import period_split  # noqa: E402
import datasets.live_weather as live_weather_loader  # noqa: E402
import datasets.traffic as traffic_loader  # noqa: E402
import datasets.ili as ili_loader  # noqa: E402
import datasets.generic_csv as generic_csv_loader  # noqa: E402

from services.evaluator import compute_metrics_table, compute_mase_denominators, summarize  # noqa: E402
from services.plotting import plot_forecasts  # noqa: E402

__all__ = [
    "BaseForecaster",
    "TensorARForecaster", "SARIMAForecaster", "ETSForecaster",
    "DLinearForecaster", "ITransformerForecaster", "TimeXerForecaster", "TimeMixerForecaster",
    "DatasetBundle", "standard_split", "period_split",
    "live_weather_loader", "traffic_loader", "ili_loader", "generic_csv_loader",
    "compute_metrics_table", "compute_mase_denominators", "summarize",
    "plot_forecasts",
]
