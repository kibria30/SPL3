"""Seeds the 7 ForecastingModel rows (mirroring forecasting/config.py's MODEL_REGISTRY) and the
3 system Dataset rows (weather -> live_weather loader, traffic, ili). Idempotent -- safe to
re-run; existing rows (matched by slug) are left untouched.

Usage: python -m app.seed
"""
from sqlalchemy.orm import Session

from app.core.db import SessionLocal
from app.db_models.dataset import Dataset, DatasetSource, DatasetStatus, DatasetVisibility
from app.db_models.forecasting_model import ForecastingModel, ModelFamily
from app.services.forecasting_bridge import ili_loader, live_weather_loader, traffic_loader

MODELS = [
    dict(
        slug="tensor_ar", name="Tensor-AR (PowerCast)", family=ModelFamily.classical,
        requires_training=False, default_hyperparams={"rank": 2, "ar_lags": 1},
        description="Reshapes pre-test history into a (period, time, features) tensor, fits a "
                     "rank-R PARAFAC/CP decomposition, forecasts each latent factor forward with "
                     "AutoReg, and reconstructs the forecast. The paper this project is built to demonstrate.",
        paper_title="Tensor decomposition for forecasting", publication=None, year=None, authors=None,
    ),
    dict(
        slug="sarima", name="SARIMA", family=ModelFamily.classical,
        requires_training=False, default_hyperparams={"order": [2, 1, 2], "seasonal_order_pdq": [1, 0, 1]},
        description="One independent SARIMAX(p,d,q)x(P,D,Q,period) model per channel, no shared "
                     "cross-variate structure.",
    ),
    dict(
        slug="ets", name="ETS (Holt-Winters)", family=ModelFamily.classical,
        requires_training=False, default_hyperparams={},
        description="One independent additive Holt-Winters exponential smoothing model per channel.",
    ),
    dict(
        slug="dlinear", name="DLinear", family=ModelFamily.trained,
        requires_training=True, default_hyperparams={"epochs": 100, "lr": 1e-3, "batch_size": 64, "patience": 5},
        description="Decomposes the input into trend and seasonal components, applies one linear "
                     "layer per component, sums the two predictions.",
        paper_title="Are Transformers Effective for Time Series Forecasting?",
        publication="AAAI", year=2023, authors="Zeng et al.",
        github_url="https://github.com/cure-lab/LTSF-Linear",
    ),
    dict(
        slug="itransformer", name="iTransformer", family=ModelFamily.trained,
        requires_training=True, default_hyperparams={"epochs": 100, "lr": 1e-3, "batch_size": 64, "patience": 5},
        description="Each variate's entire series becomes one token; self-attention runs across "
                     "variate-tokens instead of across time steps.",
        paper_title="iTransformer: Inverted Transformers Are Effective for Time Series Forecasting",
        publication="ICLR", year=2024, authors="Liu et al.",
        github_url="https://github.com/thuml/iTransformer",
    ),
    dict(
        slug="timexer", name="TimeXer", family=ModelFamily.trained,
        requires_training=True, default_hyperparams={"epochs": 100, "lr": 1e-3, "batch_size": 64, "patience": 5},
        description="Patch-embeds each variate plus a learned global token; the global token "
                     "cross-attends to whole-series embeddings of all variates.",
        paper_title="TimeXer: Empowering Transformers for Time Series Forecasting with Exogenous Variables",
        publication="NeurIPS", year=2024, authors="Wang et al.",
        github_url="https://github.com/thuml/TimeXer",
    ),
    dict(
        slug="timemixer", name="TimeMixer", family=ModelFamily.trained,
        requires_training=True, default_hyperparams={"epochs": 100, "lr": 1e-3, "batch_size": 64, "patience": 5},
        description="Decomposes at multiple down-sampled scales; seasonal mixed bottom-up, trend "
                     "mixed top-down; per-scale predictors summed.",
        paper_title="TimeMixer: Decomposable Multiscale Mixing for Time Series Forecasting",
        publication="ICLR", year=2024, authors="Wang et al.",
        github_url="https://github.com/kwuking/TimeMixer",
    ),
]

# period_length mirrors forecasting/config.py's DATASETS[...]["tensor_period"] for these 3.
# `fetch` calls the real loader (network I/O) so the row/available_columns/file_path fields
# are populated from real data at seed time, rather than left as empty placeholders -- see
# module docstring. This is the same operation admin.py's "refresh system dataset" route
# (Phase 6) will re-run on demand; here it just runs once up front.
SYSTEM_DATASETS = [
    dict(
        slug="weather", name="Weather (Live, Open-Meteo)", frequency="hourly", period_length=24,
        fetch=lambda: (live_weather_loader.load_dataframe(), None),
    ),
    dict(
        slug="traffic", name="Traffic (California road occupancy)", frequency="hourly", period_length=24,
        fetch=lambda: (traffic_loader.load_dataframe(max_vars=50), traffic_loader.PATH),
    ),
    dict(
        slug="ili", name="ILI (CDC Influenza-Like Illness)", frequency="weekly", period_length=52,
        fetch=lambda: (ili_loader.load_dataframe(), ili_loader.PATH),
    ),
]


def seed_models(db: Session) -> None:
    for spec in MODELS:
        existing = db.query(ForecastingModel).filter(ForecastingModel.slug == spec["slug"]).first()
        if existing is not None:
            continue
        db.add(ForecastingModel(**spec))
    db.commit()


def seed_system_datasets(db: Session) -> None:
    for spec in SYSTEM_DATASETS:
        existing = db.query(Dataset).filter(Dataset.slug == spec["slug"]).first()
        if existing is not None:
            continue

        try:
            df, file_path = spec["fetch"]()
            available_columns = [{"name": str(c), "dtype": str(df[c].dtype)} for c in df.columns]
            dataset = Dataset(
                slug=spec["slug"], name=spec["name"], source=DatasetSource.system,
                visibility=DatasetVisibility.system, frequency=spec["frequency"],
                period_length=spec["period_length"], rows=len(df), file_path=file_path,
                available_columns=available_columns,
                selected_columns=[c["name"] for c in available_columns],
                status=DatasetStatus.ready,
            )
        except Exception as e:
            print(f"!! Could not fetch system dataset '{spec['slug']}': {e}")
            print(f"   Seeded as pending -- retry later via the admin refresh action.")
            dataset = Dataset(
                slug=spec["slug"], name=spec["name"], source=DatasetSource.system,
                visibility=DatasetVisibility.system, frequency=spec["frequency"],
                period_length=spec["period_length"], rows=0,
                available_columns=[], selected_columns=[],
                status=DatasetStatus.error,
            )
        db.add(dataset)
    db.commit()


def main():
    db = SessionLocal()
    try:
        seed_models(db)
        seed_system_datasets(db)
        print(f"Seeded {len(MODELS)} models, {len(SYSTEM_DATASETS)} system datasets (idempotent).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
