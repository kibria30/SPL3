"""Live Weather (Open-Meteo).

Hourly weather fetched live from the Open-Meteo historical-archive API
(https://open-meteo.com/en/docs/historical-weather-api, no API key required) rather than a
static file -- unlike every other loader in this project. Default location is Dhaka, Bangladesh
(23.8103N, 90.4125E) and the four hourly variables (`temperature_2m`, `relative_humidity_2m`,
`precipitation`, `wind_speed_10m`), matching the user's own exploratory notebook
(`Experiment-Passed/LiveWeatherCast.ipynb`).

"Live" means the date range defaults to a rolling ~3-year window ending 2 days ago (Open-Meteo's
archive is reanalysis-based, not raw station telemetry, so it always has a short ingestion lag)
-- rerunning this loader on a later date pulls a later window, unlike every other dataset here
which is a fixed historical file. The fetched response is cached to disk keyed by
(lat, lon, start_date, end_date), so repeated runs on the same day reuse the cache instead of
re-hitting the API; passing an explicit `start_date`/`end_date` pins the window for a
reproducible/offline run.
"""
import os
from datetime import date, timedelta

import numpy as np
import pandas as pd
import requests

from datasets.base import standard_split, DatasetBundle

API_URL = "https://archive-api.open-meteo.com/v1/archive"
CACHE_DIR = "./data/live_weather"

HOURLY_VARS = ["temperature_2m", "relative_humidity_2m", "precipitation", "wind_speed_10m"]

DEFAULT_LATITUDE = 23.8103
DEFAULT_LONGITUDE = 90.4125
DEFAULT_HISTORY_DAYS = 3 * 365  # ~3 years hourly -- same order of magnitude as the Weather dataset
ARCHIVE_LAG_DAYS = 2  # Open-Meteo's archive endpoint needs a couple days to ingest


def _fetch(latitude: float, longitude: float, start_date: str, end_date: str) -> pd.DataFrame:
    os.makedirs(CACHE_DIR, exist_ok=True)
    cache_path = os.path.join(CACHE_DIR, f"{latitude}_{longitude}_{start_date}_{end_date}.csv")

    if os.path.exists(cache_path):
        print(f"[skip] {cache_path} already exists")
        return pd.read_csv(cache_path)

    print(f"Fetching {API_URL} for ({latitude}, {longitude}), {start_date}..{end_date}")
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": start_date,
        "end_date": end_date,
        "hourly": ",".join(HOURLY_VARS),
    }
    try:
        response = requests.get(API_URL, params=params, timeout=60)
        response.raise_for_status()
        df = pd.DataFrame(response.json()["hourly"])
    except Exception as e:
        raise RuntimeError(
            f"Could not fetch live weather data from {API_URL}: {e}. Place a cached CSV with "
            f"columns time,{','.join(HOURLY_VARS)} at {cache_path} to run offline."
        )

    df.to_csv(cache_path, index=False)
    return df


def load(seq_len: int = 96, pred_len: int = 96, latitude: float = DEFAULT_LATITUDE,
          longitude: float = DEFAULT_LONGITUDE, start_date: str = None,
          end_date: str = None) -> DatasetBundle:
    if end_date is None:
        end_date = (date.today() - timedelta(days=ARCHIVE_LAG_DAYS)).isoformat()
    if start_date is None:
        start_date = (date.fromisoformat(end_date) - timedelta(days=DEFAULT_HISTORY_DAYS)).isoformat()

    df = _fetch(latitude, longitude, start_date, end_date)
    df = df[HOURLY_VARS].interpolate(method="linear", limit_direction="both")

    values = df.values.astype(np.float32)
    return standard_split(values, seq_len, pred_len, name="LiveWeather", feature_names=HOURLY_VARS)
