import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user
from app.db_models.dataset import Dataset, DatasetSource, DatasetStatus, DatasetVisibility
from app.db_models.user import User
from app.schemas.dataset import DatasetColumnUpdate, DatasetOut, DatasetPreviewOut, SplitPreviewOut
from app.services import upload_service
from app.services.dataset_registry import SYSTEM_LOADERS
from app.services.eligibility import compute_eligibility

router = APIRouter(prefix="/datasets", tags=["datasets"])

_NUMERIC_DTYPE_PREFIXES = ("int", "uint", "float", "complex")


def _is_numeric_dtype(dtype: str) -> bool:
    return dtype.startswith(_NUMERIC_DTYPE_PREFIXES)


def _get_visible_dataset_or_404(dataset_id: int, user: User, db: Session) -> Dataset:
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    visible = (
        dataset.visibility in (DatasetVisibility.system, DatasetVisibility.public)
        or dataset.owner_id == user.id
    )
    if not visible:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this dataset")
    return dataset


@router.get("", response_model=list[DatasetOut])
def list_datasets(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(Dataset)
        .filter(
            or_(
                Dataset.visibility == DatasetVisibility.system,
                Dataset.visibility == DatasetVisibility.public,
                Dataset.owner_id == user.id,
            )
        )
        .order_by(Dataset.uploaded_at.desc())
        .all()
    )


@router.get("/{dataset_id}", response_model=DatasetOut)
def get_dataset(dataset_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _get_visible_dataset_or_404(dataset_id, user, db)


@router.post("/upload", response_model=DatasetOut, status_code=status.HTTP_201_CREATED)
def upload_dataset(
    name: str = Form(...),
    frequency: str = Form(...),
    period_length: int = Form(...),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    dataset = Dataset(
        owner_id=user.id, slug=None, name=name, source=DatasetSource.user,
        visibility=DatasetVisibility.private, frequency=frequency, period_length=period_length,
        rows=0, available_columns=[], selected_columns=[],
        status=DatasetStatus.pending_column_selection,
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    try:
        file_path = upload_service.save_upload(file, user_id=user.id, dataset_id=dataset.id)
        df = upload_service.read_raw_dataframe(file_path)
    except Exception as e:
        dataset.status = DatasetStatus.error
        db.commit()
        raise HTTPException(status_code=422, detail=f"Could not parse uploaded file: {e}")

    dataset.file_path = file_path
    dataset.rows = len(df)
    dataset.available_columns = upload_service.describe_columns(df)
    db.commit()
    db.refresh(dataset)
    return dataset


@router.patch("/{dataset_id}", response_model=DatasetOut)
def update_dataset_columns(
    dataset_id: int,
    payload: DatasetColumnUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    if dataset.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the dataset owner can edit it")

    col_dtypes = {c["name"]: c["dtype"] for c in dataset.available_columns}
    unknown = set(payload.selected_columns) - set(col_dtypes)
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown columns: {sorted(unknown)}")

    non_numeric = [c for c in payload.selected_columns if not _is_numeric_dtype(col_dtypes[c])]
    if non_numeric:
        raise HTTPException(
            status_code=422,
            detail=f"Selected columns must be numeric: {non_numeric} are not "
                   "(e.g. exclude a timestamp column from the forecast channels).",
        )

    dataset.selected_columns = payload.selected_columns
    if payload.frequency:
        dataset.frequency = payload.frequency
    if payload.period_length:
        dataset.period_length = payload.period_length
    if payload.visibility:
        dataset.visibility = payload.visibility
    dataset.status = DatasetStatus.ready

    db.commit()
    db.refresh(dataset)
    return dataset


@router.get("/{dataset_id}/preview", response_model=DatasetPreviewOut)
def preview_dataset(dataset_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    dataset = _get_visible_dataset_or_404(dataset_id, user, db)

    try:
        if dataset.source == DatasetSource.user:
            if not dataset.file_path:
                raise ValueError("Dataset file not yet uploaded.")
            df = upload_service.read_raw_dataframe(dataset.file_path)
        else:
            loader = SYSTEM_LOADERS.get(dataset.slug)
            if loader is None:
                raise ValueError(f"No loader registered for system dataset '{dataset.slug}'")
            df = loader()
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not read dataset: {e}")

    preview_rows = json.loads(df.head(10).to_json(orient="records"))
    return DatasetPreviewOut(dataset=DatasetOut.model_validate(dataset), preview_rows=preview_rows)


@router.get("/{dataset_id}/split-preview", response_model=SplitPreviewOut)
def split_preview(
    dataset_id: int,
    test_periods: int,
    input_periods: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    dataset = _get_visible_dataset_or_404(dataset_id, user, db)
    if input_periods >= test_periods:
        raise HTTPException(status_code=422, detail="input_periods must be < test_periods")
    try:
        result = compute_eligibility(db, dataset, test_periods, input_periods)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return SplitPreviewOut(**result.__dict__)
