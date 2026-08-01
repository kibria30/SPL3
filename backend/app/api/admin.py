import os

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import require_admin
from app.db_models.dataset import Dataset, DatasetSource, DatasetStatus
from app.db_models.experiment import Experiment
from app.db_models.user import User
from app.schemas.auth import UserOut, UserRoleUpdate
from app.schemas.dataset import DatasetOut, DatasetVisibilityUpdate
from app.services.dataset_registry import SYSTEM_LOADERS

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/datasets/system/{slug}/refresh", response_model=DatasetOut)
def refresh_system_dataset(slug: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    dataset = (
        db.query(Dataset)
        .filter(Dataset.slug == slug, Dataset.source == DatasetSource.system)
        .first()
    )
    if dataset is None:
        raise HTTPException(status_code=404, detail=f"No system dataset with slug '{slug}'")

    loader = SYSTEM_LOADERS.get(slug)
    if loader is None:
        raise HTTPException(status_code=400, detail=f"No loader registered for '{slug}'")

    try:
        df = loader()
    except Exception as e:
        dataset.status = DatasetStatus.error
        db.commit()
        raise HTTPException(status_code=422, detail=f"Could not refresh dataset: {e}")

    # Traffic's header=None CSV yields integer column labels -- normalize to strings, matching
    # the invariant dataset_registry.load_dataset_dataframe() also relies on.
    df.columns = [str(c) for c in df.columns]

    dataset.rows = len(df)
    dataset.available_columns = [{"name": c, "dtype": str(df[c].dtype)} for c in df.columns]
    # Keep the existing channel selection if it's still valid against the refreshed columns,
    # otherwise fall back to selecting everything.
    if not (dataset.selected_columns and set(dataset.selected_columns).issubset(set(df.columns))):
        dataset.selected_columns = list(df.columns)
    dataset.status = DatasetStatus.ready

    db.commit()
    db.refresh(dataset)
    return dataset


@router.patch("/datasets/{dataset_id}/visibility", response_model=DatasetOut)
def update_dataset_visibility(
    dataset_id: int,
    payload: DatasetVisibilityUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if dataset.source == DatasetSource.system:
        raise HTTPException(status_code=400, detail="System dataset visibility cannot be changed")

    dataset.visibility = payload.visibility
    db.commit()
    db.refresh(dataset)
    return dataset


@router.delete("/datasets/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dataset(dataset_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if dataset.source == DatasetSource.system:
        raise HTTPException(status_code=400, detail="System datasets cannot be deleted")

    experiment_count = db.query(Experiment).filter(Experiment.dataset_id == dataset_id).count()
    if experiment_count:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete: {experiment_count} experiment(s) still reference this dataset",
        )

    if dataset.file_path and os.path.exists(dataset.file_path):
        os.remove(dataset.file_path)

    db.delete(dataset)
    db.commit()


@router.get("/users", response_model=list[UserOut])
def list_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(User).order_by(User.id).all()


@router.patch("/users/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: int, payload: UserRoleUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = payload.role
    db.commit()
    db.refresh(user)
    return user
