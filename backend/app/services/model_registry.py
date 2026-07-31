"""Maps a ForecastingModel DB row's slug to a builder that constructs the real forecaster
instance, mirroring forecasting/config.py's MODEL_REGISTRY pattern almost verbatim -- DB rows
are metadata-only (display info), actual class resolution is this plain dict lookup.
"""
from app.services.forecasting_bridge import (
    DLinearForecaster,
    ETSForecaster,
    ITransformerForecaster,
    SARIMAForecaster,
    TensorARForecaster,
    TimeMixerForecaster,
    TimeXerForecaster,
)

MODEL_BUILDERS = {
    "tensor_ar": lambda period, hp: TensorARForecaster(
        period=period, rank=hp.get("rank", 2), ar_lags=hp.get("ar_lags", 1)
    ),
    "sarima": lambda period, hp: SARIMAForecaster(
        period=period,
        order=tuple(hp.get("order", (2, 1, 2))),
        seasonal_order_pdq=tuple(hp.get("seasonal_order_pdq", (1, 0, 1))),
    ),
    "ets": lambda period, hp: ETSForecaster(period=period, **{k: v for k, v in hp.items() if k != "period"}),
    "dlinear": lambda period, hp: DLinearForecaster(
        epochs=hp.get("epochs", 100), lr=hp.get("lr", 1e-3),
        batch_size=hp.get("batch_size", 64), patience=hp.get("patience", 5),
    ),
    "itransformer": lambda period, hp: ITransformerForecaster(
        epochs=hp.get("epochs", 100), lr=hp.get("lr", 1e-3),
        batch_size=hp.get("batch_size", 64), patience=hp.get("patience", 5),
    ),
    "timexer": lambda period, hp: TimeXerForecaster(
        epochs=hp.get("epochs", 100), lr=hp.get("lr", 1e-3),
        batch_size=hp.get("batch_size", 64), patience=hp.get("patience", 5),
    ),
    "timemixer": lambda period, hp: TimeMixerForecaster(
        epochs=hp.get("epochs", 100), lr=hp.get("lr", 1e-3),
        batch_size=hp.get("batch_size", 64), patience=hp.get("patience", 5),
    ),
}


def build_model(slug: str, period: int, hyperparams: dict):
    builder = MODEL_BUILDERS.get(slug)
    if builder is None:
        raise ValueError(f"No model builder registered for slug '{slug}'")
    return builder(period, hyperparams or {})
