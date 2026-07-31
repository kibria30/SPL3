"""Loader for user-uploaded CSV/XLSX datasets. Unlike the system dataset loaders
(traffic/ili/live_weather), there's no fixed schema -- upload_service.py has already captured
the available columns and lets the user pick which ones to keep as forecast channels.
"""
import pandas as pd


def load_dataframe(file_path: str, columns: list = None) -> pd.DataFrame:
    if file_path.lower().endswith((".xlsx", ".xls")):
        df = pd.read_excel(file_path)
    else:
        df = pd.read_csv(file_path)

    if columns is not None:
        df = df[columns]

    numeric_df = df.select_dtypes(include="number")
    dropped = set(df.columns) - set(numeric_df.columns)
    if dropped:
        raise ValueError(
            f"Selected columns {sorted(dropped)} are not numeric -- forecasting requires "
            "numeric columns only. Exclude non-numeric columns (e.g. a timestamp) from the "
            "selection."
        )
    return numeric_df
