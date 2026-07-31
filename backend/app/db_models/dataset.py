import enum
from datetime import datetime, timezone

from sqlalchemy import Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class DatasetSource(str, enum.Enum):
    system = "system"
    user = "user"


class DatasetVisibility(str, enum.Enum):
    system = "system"
    private = "private"
    public = "public"


class DatasetStatus(str, enum.Enum):
    pending_column_selection = "pending_column_selection"
    ready = "ready"
    error = "error"


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)  # NULL = system dataset

    slug: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)  # "weather"/"traffic"/"ili"
    name: Mapped[str] = mapped_column(String(255))
    source: Mapped[DatasetSource] = mapped_column(Enum(DatasetSource, name="dataset_source"))
    visibility: Mapped[DatasetVisibility] = mapped_column(Enum(DatasetVisibility, name="dataset_visibility"))

    file_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)  # lazily populated for live_weather
    frequency: Mapped[str] = mapped_column(String(32))  # "hourly", "weekly", ... informational only
    period_length: Mapped[int] = mapped_column(Integer)  # timesteps per natural cycle (tensor_period concept)
    rows: Mapped[int] = mapped_column(Integer, default=0)

    available_columns: Mapped[list] = mapped_column(JSONB, default=list)  # [{"name":..,"dtype":..}, ...]
    selected_columns: Mapped[list] = mapped_column(JSONB, default=list)  # forecast channels (all, multivariate)

    status: Mapped[DatasetStatus] = mapped_column(
        Enum(DatasetStatus, name="dataset_status"), default=DatasetStatus.pending_column_selection
    )
    uploaded_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
