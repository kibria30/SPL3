from pydantic import BaseModel


class PlatformStatsOut(BaseModel):
    dataset_count: int
    model_count: int
    experiment_count: int
    completed_experiment_count: int
    user_count: int
