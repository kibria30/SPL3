"""Given a dataset and the user's chosen period-based split parameters, decides which models
are runnable. Classical models (tensor_ar/sarima/ets) only ever need `eval_input`, so they're
always eligible. Trained models need real training AND validation data -- services/trainer.py's
TorchForecaster.fit() calls utils/windows.py::build_windows() on both train and val series, and
build_windows() raises if it can't build even one seq_len+pred_len window from either. This is
stricter than "any train data at all" -- see the plan's discussion of this discrepancy.
"""
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.db_models.dataset import Dataset
from app.db_models.forecasting_model import ForecastingModel, ModelFamily

DEFAULT_VAL_RATIO = 0.2


@dataclass
class SplitEligibility:
    seq_len: int
    pred_len: int
    train_len: int
    val_len: int
    train_fit_len: int
    has_train_data: bool
    dl_eligible: bool
    eligible_model_slugs: list[str]
    ineligible_reason: str | None  # explains why trained models are excluded, if they are


def compute_eligibility(
    db: Session, dataset: Dataset, test_periods: int, input_periods: int,
    val_ratio: float = DEFAULT_VAL_RATIO,
) -> SplitEligibility:
    if input_periods >= test_periods:
        raise ValueError(f"input_periods ({input_periods}) must be < test_periods ({test_periods})")

    period_len = dataset.period_length
    seq_len = input_periods * period_len
    pred_len = (test_periods - input_periods) * period_len

    train_len = max(0, dataset.rows - test_periods * period_len)
    val_len = int(train_len * val_ratio)
    train_fit_len = train_len - val_len

    window_len = seq_len + pred_len
    dl_eligible = train_fit_len >= window_len and val_len >= window_len

    ineligible_reason = None
    if not dl_eligible:
        if train_len == 0:
            ineligible_reason = "No train data left before the test window -- only classical models can run."
        else:
            ineligible_reason = (
                f"Train data ({train_fit_len} pts) or validation data ({val_len} pts) is shorter "
                f"than one input+output window ({window_len} pts) -- shorten the test/input "
                "window or use a longer dataset."
            )

    models = db.query(ForecastingModel).all()
    eligible_slugs = [
        m.slug for m in models
        if m.family == ModelFamily.classical or (m.family == ModelFamily.trained and dl_eligible)
    ]

    return SplitEligibility(
        seq_len=seq_len, pred_len=pred_len, train_len=train_len, val_len=val_len,
        train_fit_len=train_fit_len, has_train_data=train_len > 0, dl_eligible=dl_eligible,
        eligible_model_slugs=eligible_slugs, ineligible_reason=ineligible_reason,
    )
