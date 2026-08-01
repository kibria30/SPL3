from datetime import datetime

from pydantic import BaseModel, Field

from app.db_models.experiment import ExperimentStatus


class ExperimentCreate(BaseModel):
    dataset_id: int
    model_slug: str
    experiment_name: str
    task_type: str = "forecasting"
    test_periods: int = Field(ge=8, le=25)
    input_periods: int = Field(ge=5, le=20)
    val_ratio: float = Field(default=0.2, gt=0, lt=1)
    hyperparams: dict = Field(default_factory=dict)


class ExperimentOut(BaseModel):
    id: int
    user_id: int
    model_id: int
    dataset_id: int
    experiment_name: str
    task_type: str
    test_periods: int
    input_periods: int
    output_periods: int
    period_length: int
    seq_len: int
    pred_len: int
    val_ratio: float
    hyperparams: dict
    has_train_data: bool
    status: ExperimentStatus
    error_message: str | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class ResultOut(BaseModel):
    training_time_seconds: float
    num_parameters: int | None
    metrics_per_feature: list[dict]
    metrics_avg: dict
    actual_sequence_path: str
    predicted_sequence_path: str

    model_config = {"from_attributes": True}


class SeriesOut(BaseModel):
    feature_names: list[str]
    actual: list[list[float]]
    predicted: list[list[float]]


class ExperimentBatchCreate(BaseModel):
    dataset_id: int
    experiment_name_prefix: str
    task_type: str = "forecasting"
    test_periods: int = Field(ge=8, le=25)
    input_periods: int = Field(ge=5, le=20)
    val_ratio: float = Field(default=0.2, gt=0, lt=1)
    model_slugs: list[str] = Field(min_length=1)


class SkippedModelOut(BaseModel):
    model_slug: str
    reason: str


class ExperimentBatchOut(BaseModel):
    dataset_id: int
    test_periods: int
    input_periods: int
    val_ratio: float
    created: list[ExperimentOut]
    skipped: list[SkippedModelOut]


class ComparisonEntryOut(BaseModel):
    experiment: ExperimentOut
    model_slug: str
    model_name: str
    model_family: str
    result: ResultOut | None


class ComparisonViewOut(BaseModel):
    dataset_id: int
    dataset_name: str
    dataset_slug: str | None
    test_periods: int
    input_periods: int
    period_length: int
    seq_len: int
    pred_len: int
    entries: list[ComparisonEntryOut]


class ComparisonGroupOut(BaseModel):
    dataset_id: int
    dataset_name: str
    test_periods: int
    input_periods: int
    period_length: int
    model_slugs: list[str]
    experiment_count: int
    completed_count: int
    latest_created_at: datetime
