from datetime import datetime

from pydantic import BaseModel

from app.db_models.forecasting_model import ModelFamily


class ForecastingModelOut(BaseModel):
    id: int
    slug: str
    name: str
    family: ModelFamily
    requires_training: bool
    default_hyperparams: dict
    paper_title: str | None
    publication: str | None
    year: int | None
    authors: str | None
    description: str | None
    github_url: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
