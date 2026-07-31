"""Parses a user-uploaded CSV/XLSX for the dataset-upload flow. Deliberately does NOT enforce
numeric-only columns the way forecasting/datasets/generic_csv.py::load_dataframe() does --
this step needs to see ALL columns (including a timestamp column, if any) so the user can pick
which ones to keep. generic_csv.load_dataframe() is used later, at experiment-run time, once
Dataset.selected_columns has already excluded any non-numeric column.
"""
import os

import pandas as pd
from fastapi import UploadFile

from app.core.config import settings

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}


def read_raw_dataframe(file_path: str) -> pd.DataFrame:
    if file_path.lower().endswith((".xlsx", ".xls")):
        return pd.read_excel(file_path)
    return pd.read_csv(file_path)


def describe_columns(df: pd.DataFrame) -> list[dict]:
    return [{"name": str(c), "dtype": str(df[c].dtype)} for c in df.columns]


def save_upload(file: UploadFile, user_id: int, dataset_id: int) -> str:
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file type '{ext}' -- only CSV/XLSX are accepted.")

    dest_dir = settings.storage_dir / "datasets" / "user" / str(user_id) / str(dataset_id)
    os.makedirs(dest_dir, exist_ok=True)
    dest_path = dest_dir / (file.filename or f"upload{ext}")

    with open(dest_path, "wb") as f:
        f.write(file.file.read())

    return str(dest_path)
