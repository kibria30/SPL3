from datetime import datetime, timezone

from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Result(Base):
    __tablename__ = "results"

    id: Mapped[int] = mapped_column(primary_key=True)
    experiment_id: Mapped[int] = mapped_column(ForeignKey("experiments.id"), unique=True)

    training_time_seconds: Mapped[float] = mapped_column(Float)
    num_parameters: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Same shapes services/evaluator.py's compute_metrics_table()/summarize() already produce --
    # reused directly, not reimplemented. JSONB per-feature rows, not a normalized child table
    # (kept to exactly 5 tables; the app's query pattern is "one experiment's full breakdown,"
    # never cross-experiment SQL aggregation).
    metrics_per_feature: Mapped[list] = mapped_column(JSONB)  # [{"feature":..,"MSE":..,...}, ...]
    metrics_avg: Mapped[dict] = mapped_column(JSONB)          # {"MSE":..,"MAE":..,...}

    actual_sequence_path: Mapped[str] = mapped_column(String(1024))
    predicted_sequence_path: Mapped[str] = mapped_column(String(1024))
    plot_paths: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
