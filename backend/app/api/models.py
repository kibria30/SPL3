from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user
from app.db_models.forecasting_model import ForecastingModel
from app.db_models.user import User
from app.schemas.model import ForecastingModelOut

router = APIRouter(prefix="/models", tags=["models"])


@router.get("", response_model=list[ForecastingModelOut])
def list_models(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(ForecastingModel).order_by(ForecastingModel.id).all()
