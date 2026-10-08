"""Given a dataset and the user's chosen period-based split parameters, decides which models
are runnable. Classical models (tensor_ar/sarima/ets) only ever need `eval_input`, so they're
always eligible. Trained models need real training AND validation data -- services/trainer.py's
TorchForecaster.fit() calls utils/windows.py::build_windows() on both train and val series.

The validation segment carries `seq_len` rows of look-back overlap taken from the end of the fit
portion (the same scheme as forecasting/datasets/base.py::standard_split), so it only has to hold
the targets: `val_len >= pred_len`, not a whole `seq_len + pred_len` window by itself. The fit
portion must still hold at least one window, and enough of them (MIN_TRAIN_WINDOWS) for a trained
model to be meaningful rather than merely runnable.
"""
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.db_models.dataset import Dataset
from app.db_models.forecasting_model import ForecastingModel, ModelFamily

DEFAULT_VAL_RATIO = 0.2
MIN_TRAIN_WINDOWS = 100  # below this a trained model "runs" but has too few windows to learn from
RECOMMEND_MAX_TEST_PERIODS = 10  # the form's historical default; recommend the largest test that still fits


@dataclass
class SplitEligibility:
    seq_len: int
    pred_len: int
    train_len: int
    val_len: int
    train_fit_len: int
    test_len: int
    train_windows: int
    has_train_data: bool
    dl_eligible: bool
    eligible_model_slugs: list[str]
    ineligible_reason: str | None  # explains why trained models are excluded, if they are
    recommended_test_periods: int | None
    recommended_input_periods: int | None


def _lengths(rows: int, period_len: int, test_periods: int, input_periods: int, val_ratio: float) -> dict:
    seq_len = input_periods * period_len
    pred_len = (test_periods - input_periods) * period_len
    train_len = max(0, rows - test_periods * period_len)
    val_len = int(train_len * val_ratio)
    train_fit_len = train_len - val_len
    window_len = seq_len + pred_len
    return dict(
        seq_len=seq_len, pred_len=pred_len, train_len=train_len, val_len=val_len, train_fit_len=train_fit_len,
        window_len=window_len, train_windows=max(0, train_fit_len - window_len + 1),
    )


def _dl_failure(l: dict) -> str | None:
    """None if trained models can run on this split, else a message naming the failed condition."""
    if l["train_len"] == 0:
        return "No train data left before the test window -- only classical models can run."
    if l["train_fit_len"] < l["window_len"]:
        return (
            f"Training data ({l['train_fit_len']} pts) is shorter than one input+output window "
            f"({l['window_len']} pts) -- shorten the test/input window or use a longer dataset."
        )
    if l["val_len"] < l["pred_len"]:
        return (
            f"Validation data ({l['val_len']} pts) is shorter than the forecast horizon "
            f"({l['pred_len']} pts) -- shorten the horizon or raise the validation ratio."
        )
    if l["train_windows"] < MIN_TRAIN_WINDOWS:
        return (
            f"Only {l['train_windows']} training windows (need at least {MIN_TRAIN_WINDOWS}) -- "
            "shorten the test/input window or use a longer dataset."
        )
    return None


def recommend_split(rows: int, period_len: int, val_ratio: float = DEFAULT_VAL_RATIO) -> tuple[int, int] | None:
    """(test_periods, input_periods) with the largest test window (<= RECOMMEND_MAX_TEST_PERIODS)
    on which trained models are still eligible, i.e. the longest-train split that stays runnable
    without shrinking the test more than needed. None if no split of >= 3 test periods works.
    """
    for test_periods in range(RECOMMEND_MAX_TEST_PERIODS, 2, -1):
        input_periods = max(1, min(test_periods - 1, round(test_periods * 0.6)))
        if _dl_failure(_lengths(rows, period_len, test_periods, input_periods, val_ratio)) is None:
            return test_periods, input_periods
    return None


def compute_eligibility(
    db: Session, dataset: Dataset, test_periods: int, input_periods: int,
    val_ratio: float = DEFAULT_VAL_RATIO,
) -> SplitEligibility:
    if input_periods >= test_periods:
        raise ValueError(f"input_periods ({input_periods}) must be < test_periods ({test_periods})")

    period_len = dataset.period_length
    l = _lengths(dataset.rows, period_len, test_periods, input_periods, val_ratio)
    ineligible_reason = _dl_failure(l)
    dl_eligible = ineligible_reason is None

    models = db.query(ForecastingModel).all()
    eligible_slugs = [
        m.slug for m in models
        if m.family == ModelFamily.classical or (m.family == ModelFamily.trained and dl_eligible)
    ]

    recommended = recommend_split(dataset.rows, period_len, val_ratio)
    return SplitEligibility(
        seq_len=l["seq_len"], pred_len=l["pred_len"], train_len=l["train_len"], val_len=l["val_len"],
        train_fit_len=l["train_fit_len"], test_len=test_periods * period_len, train_windows=l["train_windows"],
        has_train_data=l["train_len"] > 0, dl_eligible=dl_eligible,
        eligible_model_slugs=eligible_slugs, ineligible_reason=ineligible_reason,
        recommended_test_periods=recommended[0] if recommended else None,
        recommended_input_periods=recommended[1] if recommended else None,
    )
