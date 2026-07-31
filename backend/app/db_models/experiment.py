import enum
from datetime import datetime, timezone

from sqlalchemy import Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ExperimentStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class Experiment(Base):
    __tablename__ = "experiments"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    model_id: Mapped[int] = mapped_column(ForeignKey("forecasting_models.id"))
    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id"))
    experiment_name: Mapped[str] = mapped_column(String(255))

    # period-based split params (see forecasting/datasets/period_split.py) -- NOT ratio-based;
    # tsf_compare's standard_split()/ratio scheme is only used by its own standalone CLI.
    test_periods: Mapped[int] = mapped_column(Integer)   # 8-25
    input_periods: Mapped[int] = mapped_column(Integer)  # 5-20, < test_periods
    output_periods: Mapped[int] = mapped_column(Integer)  # derived = test_periods - input_periods
    period_length: Mapped[int] = mapped_column(Integer)   # snapshot of Dataset.period_length at run time
    seq_len: Mapped[int] = mapped_column(Integer)          # derived snapshot = input_periods * period_length
    pred_len: Mapped[int] = mapped_column(Integer)         # derived snapshot = output_periods * period_length

    val_ratio: Mapped[float] = mapped_column(Float, default=0.2)  # only meaningful for "trained" family
    hyperparams: Mapped[dict] = mapped_column(JSONB, default=dict)  # overrides Model.default_hyperparams

    has_train_data: Mapped[bool] = mapped_column(default=False)
    dataset_snapshot_meta: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # live-weather pin, etc.

    status: Mapped[ExperimentStatus] = mapped_column(
        Enum(ExperimentStatus, name="experiment_status"), default=ExperimentStatus.pending
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
    started_at: Mapped[datetime | None] = mapped_column(nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)
