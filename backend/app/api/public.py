"""Deliberately unauthenticated routes -- the landing page needs headline counts before a
visitor has logged in. Only aggregate counts are exposed here, never per-user detail.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.db_models.dataset import Dataset
from app.db_models.experiment import Experiment, ExperimentStatus
from app.db_models.forecasting_model import ForecastingModel
from app.db_models.user import User
from app.schemas.stats import PlatformStatsOut

router = APIRouter(tags=["public"])


@router.get("/stats", response_model=PlatformStatsOut)
def get_platform_stats(db: Session = Depends(get_db)):
    return PlatformStatsOut(
        dataset_count=db.query(Dataset).count(),
        model_count=db.query(ForecastingModel).count(),
        experiment_count=db.query(Experiment).count(),
        completed_experiment_count=db.query(Experiment)
        .filter(Experiment.status == ExperimentStatus.completed)
        .count(),
        user_count=db.query(User).count(),
    )
