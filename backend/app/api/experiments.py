from collections import defaultdict

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
from app.schemas.experiment import (
    ComparisonEntryOut,
    ComparisonGroupOut,
    ComparisonViewOut,
    ExperimentBatchCreate,
    ExperimentBatchOut,
    ExperimentCreate,
    ExperimentOut,
    ResultOut,
    SeriesOut,
    SkippedModelOut,
)
from app.services.eligibility import SplitEligibility, compute_eligibility
from app.services.experiment_runner import dispatch_experiment

router = APIRouter(prefix="/experiments", tags=["experiments"])


def _owned_experiment_or_404(experiment_id: int, user: User, db: Session) -> Experiment:
    experiment = db.get(Experiment, experiment_id)
    if experiment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found")
    if experiment.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    return experiment


def _create_experiment_row(
    db: Session, user: User, dataset: Dataset, model: ForecastingModel, elig: SplitEligibility,
    experiment_name: str, test_periods: int, input_periods: int, val_ratio: float, hyperparams: dict,
) -> Experiment:
    experiment = Experiment(
        user_id=user.id, model_id=model.id, dataset_id=dataset.id,
        experiment_name=experiment_name,
        test_periods=test_periods, input_periods=input_periods,
        output_periods=test_periods - input_periods,
        period_length=dataset.period_length, seq_len=elig.seq_len, pred_len=elig.pred_len,
        val_ratio=val_ratio, hyperparams=hyperparams,
        has_train_data=elig.has_train_data, status=ExperimentStatus.pending,
    )
    db.add(experiment)
    db.commit()
    db.refresh(experiment)
    dispatch_experiment(experiment.id)
    return experiment


# --- Comparison routes registered ABOVE the /{experiment_id} routes below ---------------------
# FastAPI/Starlette route matching is registration-order-based: `/{experiment_id}` structurally
# matches any single path segment, including the literal string "compare". A literal route
# registered after it would 422 (FastAPI tries to parse "compare" as an int) instead of ever
# being reached.


@router.post("/compare-batch", response_model=ExperimentBatchOut, status_code=status.HTTP_201_CREATED)
def create_comparison_batch(
    payload: ExperimentBatchCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    dataset = _get_visible_dataset_or_404(payload.dataset_id, user, db)
    if dataset.status != DatasetStatus.ready:
        raise HTTPException(status_code=422, detail="Dataset is not ready (columns not yet selected).")

    try:
        elig = compute_eligibility(db, dataset, payload.test_periods, payload.input_periods, val_ratio=payload.val_ratio)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    known_models = {
        m.slug: m
        for m in db.query(ForecastingModel).filter(ForecastingModel.slug.in_(payload.model_slugs)).all()
    }

    created: list[Experiment] = []
    skipped: list[SkippedModelOut] = []
    for slug in payload.model_slugs:
        model = known_models.get(slug)
        if model is None:
            skipped.append(SkippedModelOut(model_slug=slug, reason="Unknown model slug"))
            continue
        if slug not in elig.eligible_model_slugs:
            skipped.append(SkippedModelOut(
                model_slug=slug,
                reason=elig.ineligible_reason or f"'{slug}' is not eligible for this split.",
            ))
            continue
        experiment = _create_experiment_row(
            db, user, dataset, model, elig,
            experiment_name=f"{payload.experiment_name_prefix} — {model.name}",
            test_periods=payload.test_periods, input_periods=payload.input_periods,
            val_ratio=payload.val_ratio, hyperparams={},
        )
        created.append(experiment)

    return ExperimentBatchOut(
        dataset_id=dataset.id, test_periods=payload.test_periods, input_periods=payload.input_periods,
        val_ratio=payload.val_ratio, created=created, skipped=skipped,
    )


@router.get("/compare", response_model=ComparisonViewOut)
def get_comparison_view(
    dataset_id: int, test_periods: int, input_periods: int,
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    dataset = _get_visible_dataset_or_404(dataset_id, user, db)

    rows = (
        db.query(Experiment, ForecastingModel, Result)
        .join(ForecastingModel, Experiment.model_id == ForecastingModel.id)
        .outerjoin(Result, Result.experiment_id == Experiment.id)
        .filter(
            Experiment.user_id == user.id,
            Experiment.dataset_id == dataset_id,
            Experiment.test_periods == test_periods,
            Experiment.input_periods == input_periods,
            Experiment.period_length == dataset.period_length,
        )
        .order_by(Experiment.created_at.asc())
        .all()
    )

    entries = [
        ComparisonEntryOut(
            experiment=ExperimentOut.model_validate(experiment),
            model_slug=model.slug, model_name=model.name, model_family=model.family.value,
            result=ResultOut.model_validate(result) if result is not None else None,
        )
        for experiment, model, result in rows
    ]

    seq_len = entries[0].experiment.seq_len if entries else input_periods * dataset.period_length
    pred_len = entries[0].experiment.pred_len if entries else (test_periods - input_periods) * dataset.period_length

    return ComparisonViewOut(
        dataset_id=dataset.id, dataset_name=dataset.name, dataset_slug=dataset.slug,
        test_periods=test_periods, input_periods=input_periods, period_length=dataset.period_length,
        seq_len=seq_len, pred_len=pred_len, entries=entries,
    )


@router.get("/compare/groups", response_model=list[ComparisonGroupOut])
def list_comparison_groups(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(Experiment, ForecastingModel, Dataset)
        .join(ForecastingModel, Experiment.model_id == ForecastingModel.id)
        .join(Dataset, Experiment.dataset_id == Dataset.id)
        .filter(Experiment.user_id == user.id)
        .all()
    )

    groups: dict[tuple, list] = defaultdict(list)
    for experiment, model, dataset in rows:
        key = (dataset.id, experiment.test_periods, experiment.input_periods, experiment.period_length)
        groups[key].append((experiment, model, dataset))

    out: list[ComparisonGroupOut] = []
    for (dataset_id, test_periods, input_periods, period_length), members in groups.items():
        model_slugs = sorted({m.slug for _, m, _ in members})
        if len(model_slugs) < 2:
            continue
        dataset_name = members[0][2].name
        completed_count = sum(1 for e, _, _ in members if e.status == ExperimentStatus.completed)
        latest_created_at = max(e.created_at for e, _, _ in members)
        out.append(ComparisonGroupOut(
            dataset_id=dataset_id, dataset_name=dataset_name,
            test_periods=test_periods, input_periods=input_periods, period_length=period_length,
            model_slugs=model_slugs, experiment_count=len(members), completed_count=completed_count,
            latest_created_at=latest_created_at,
        ))

    out.sort(key=lambda g: g.latest_created_at, reverse=True)
    return out


# --- Single-experiment routes --------------------------------------------------------------


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

    return _create_experiment_row(
        db, user, dataset, model, elig,
        experiment_name=payload.experiment_name,
        test_periods=payload.test_periods, input_periods=payload.input_periods,
        val_ratio=payload.val_ratio, hyperparams=payload.hyperparams,
    )


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
