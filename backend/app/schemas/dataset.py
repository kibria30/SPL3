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


class ColumnStats(BaseModel):
    name: str
    count: int
    missing: int
    mean: float | None
    std: float | None
    min: float | None
    max: float | None


class DatasetPreviewOut(BaseModel):
    dataset: DatasetOut
    preview_rows: list[dict]  # the requested slice of rows, JSON-serializable
    total_rows: int
    row_offset: int  # 0-based index of the first returned row in the full dataset
    column_stats: list[ColumnStats]  # numeric columns only, over the full dataset


class DatasetColumnUpdate(BaseModel):
    selected_columns: list[str] = Field(min_length=1)
    frequency: str | None = None
    period_length: int | None = Field(default=None, gt=0)
    visibility: DatasetVisibility | None = None


class DatasetVisibilityUpdate(BaseModel):
    visibility: DatasetVisibility


class SplitPreviewOut(BaseModel):
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
    ineligible_reason: str | None
    recommended_test_periods: int | None
    recommended_input_periods: int | None
