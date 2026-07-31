from datetime import datetime

from pydantic import BaseModel, Field

from app.db_models.dataset import DatasetSource, DatasetStatus, DatasetVisibility


class ColumnInfo(BaseModel):
    name: str
    dtype: str


class DatasetOut(BaseModel):
    id: int
    owner_id: int | None
    slug: str | None
    name: str
    source: DatasetSource
    visibility: DatasetVisibility
    frequency: str
    period_length: int
    rows: int
    available_columns: list[ColumnInfo]
    selected_columns: list[str]
    status: DatasetStatus
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class DatasetPreviewOut(BaseModel):
    dataset: DatasetOut
    preview_rows: list[dict]  # first N rows of available_columns, JSON-serializable


class DatasetColumnUpdate(BaseModel):
    selected_columns: list[str] = Field(min_length=1)
    frequency: str | None = None
    period_length: int | None = Field(default=None, gt=0)
    visibility: DatasetVisibility | None = None


class SplitPreviewOut(BaseModel):
    seq_len: int
    pred_len: int
    train_len: int
    val_len: int
    train_fit_len: int
    has_train_data: bool
    dl_eligible: bool
    eligible_model_slugs: list[str]
    ineligible_reason: str | None
