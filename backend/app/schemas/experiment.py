from datetime import datetime

from pydantic import BaseModel, Field

from app.db_models.experiment import ExperimentStatus


class ExperimentCreate(BaseModel):
    dataset_id: int
    model_slug: str
    experiment_name: str
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
