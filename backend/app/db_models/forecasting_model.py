import enum
from datetime import datetime, timezone

from sqlalchemy import Enum, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ModelFamily(str, enum.Enum):
    classical = "classical"   # fit-once-and-extrapolate: tensor_ar, sarima, ets
    trained = "trained"       # gradient-trained seq2seq: dlinear, itransformer, timexer, timemixer


class ForecastingModel(Base):
    """Metadata-only row -- actual class resolution happens via slug in
    app/services/model_registry.py, mirroring forecasting/config.py's MODEL_REGISTRY pattern.
    """
    __tablename__ = "forecasting_models"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    family: Mapped[ModelFamily] = mapped_column(Enum(ModelFamily, name="model_family"))
    requires_training: Mapped[bool] = mapped_column(default=False)
    default_hyperparams: Mapped[dict] = mapped_column(JSONB, default=dict)

    paper_title: Mapped[str | None] = mapped_column(Text, nullable=True)
    publication: Mapped[str | None] = mapped_column(String(255), nullable=True)
    year: Mapped[int | None] = mapped_column(nullable=True)
    authors: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    github_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
