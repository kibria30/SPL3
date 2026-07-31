"""Maps a Dataset DB row to a real pandas DataFrame. System datasets resolve by slug to a
forecasting_bridge loader (mirroring forecasting/config.py's DATASETS registry pattern); user
uploads always route through generic_csv_loader against the file the user uploaded.
"""
from app.db_models.dataset import Dataset, DatasetSource
from app.services.forecasting_bridge import (
    generic_csv_loader,
    ili_loader,
    live_weather_loader,
    traffic_loader,
)

SYSTEM_LOADERS = {
    "weather": lambda: live_weather_loader.load_dataframe(),
    "traffic": lambda: traffic_loader.load_dataframe(max_vars=50),
    "ili": lambda: ili_loader.load_dataframe(),
}


def load_dataset_dataframe(dataset: Dataset):
    """Returns a DataFrame restricted to dataset.selected_columns (system loaders already only
    produce numeric columns; user uploads are filtered via generic_csv_loader).
    """
    if dataset.source == DatasetSource.system:
        loader = SYSTEM_LOADERS.get(dataset.slug)
        if loader is None:
            raise ValueError(f"No loader registered for system dataset slug '{dataset.slug}'")
        df = loader()
        # Some loaders (e.g. traffic.py's header=None CSV) produce integer column labels, but
        # column names are stored/compared as strings everywhere else in the app (seed.py,
        # upload_service.describe_columns) -- normalize before filtering by selected_columns.
        df.columns = [str(c) for c in df.columns]
        if dataset.selected_columns:
            df = df[dataset.selected_columns]
        return df

    if not dataset.file_path:
        raise ValueError(f"Dataset {dataset.id} has no uploaded file.")
    return generic_csv_loader.load_dataframe(dataset.file_path, columns=dataset.selected_columns or None)
