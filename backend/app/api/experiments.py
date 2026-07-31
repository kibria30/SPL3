import numpy as np
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.datasets import _get_visible_dataset_or_404
from app.core.db import get_db
from app.core.security import get_current_user
from app.db_models.dataset import Dataset, DatasetStatus
from app.db_models.experiment import Experiment, ExperimentStatus
from app.db_models.forecasting_model import ForecastingModel
from app.db_models.result import Result
from app.db_models.user import User
from app.schemas.experiment import ExperimentCreate, ExperimentOut, ResultOut, SeriesOut
from app.services.eligibility import compute_eligibility
from app.services.experiment_runner import dispatch_experiment

router = APIRouter(prefix="/experiments", tags=["experiments"])


def _owned_experiment_or_404(experiment_id: int, user: User, db: Session) -> Experiment:
    experiment = db.get(Experiment, experiment_id)
    if experiment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found")
    if experiment.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    return experiment


@router.post("", response_model=ExperimentOut, status_code=status.HTTP_201_CREATED)
def create_experiment(
    payload: ExperimentCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    dataset = _get_visible_dataset_or_404(payload.dataset_id, user, db)
    if dataset.status != DatasetStatus.ready:
        raise HTTPException(status_code=422, detail="Dataset is not ready (columns not yet selected).")

    model = db.query(ForecastingModel).filter(ForecastingModel.slug == payload.model_slug).first()
    if model is None:
        raise HTTPException(status_code=404, detail=f"Unknown model slug '{payload.model_slug}'")

    try:
        elig = compute_eligibility(db, dataset, payload.test_periods, payload.input_periods, val_ratio=payload.val_ratio)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if model.slug not in elig.eligible_model_slugs:
        raise HTTPException(
            status_code=422,
            detail=elig.ineligible_reason or f"Model '{model.slug}' is not eligible for this split.",
        )

    experiment = Experiment(
        user_id=user.id, model_id=model.id, dataset_id=dataset.id,
        experiment_name=payload.experiment_name,
        test_periods=payload.test_periods, input_periods=payload.input_periods,
        output_periods=payload.test_periods - payload.input_periods,
        period_length=dataset.period_length, seq_len=elig.seq_len, pred_len=elig.pred_len,
        val_ratio=payload.val_ratio, hyperparams=payload.hyperparams,
        has_train_data=elig.has_train_data, status=ExperimentStatus.pending,
    )
    db.add(experiment)
    db.commit()
    db.refresh(experiment)

    dispatch_experiment(experiment.id)
    return experiment


@router.get("", response_model=list[ExperimentOut])
def list_experiments(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(Experiment)
        .filter(Experiment.user_id == user.id)
        .order_by(Experiment.created_at.desc())
        .all()
    )


@router.get("/{experiment_id}", response_model=ExperimentOut)
def get_experiment(experiment_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _owned_experiment_or_404(experiment_id, user, db)


@router.get("/{experiment_id}/result", response_model=ResultOut)
def get_result(experiment_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    experiment = _owned_experiment_or_404(experiment_id, user, db)
    result = db.query(Result).filter(Result.experiment_id == experiment.id).first()
    if result is None:
        raise HTTPException(status_code=404, detail="Result not available yet")
    return result


@router.get("/{experiment_id}/series", response_model=SeriesOut)
def get_series(experiment_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    experiment = _owned_experiment_or_404(experiment_id, user, db)
    result = db.query(Result).filter(Result.experiment_id == experiment.id).first()
    if result is None:
        raise HTTPException(status_code=404, detail="Result not available yet")

    actual = np.load(result.actual_sequence_path)
    predicted = np.load(result.predicted_sequence_path)
    dataset = db.get(Dataset, experiment.dataset_id)

    return SeriesOut(feature_names=dataset.selected_columns, actual=actual.tolist(), predicted=predicted.tolist())
