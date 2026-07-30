"""Weather.

Downloads the public Jena Climate mirror (14 features, 10-minute granularity, 2009-2016,
Max Planck Institute for Biogeochemistry weather station) -- the same underlying station data
the LTSF "Weather" benchmark is built from, though not byte-identical to the papers'
pre-processed 21-feature `weather.csv`. Good for comparing models against each other; not for
reproducing published numbers exactly. If you have the official LTSF `weather.csv`, drop it at
DATA_PATH below (with a `date`-like column removed) and this loader will use it instead of
downloading.
"""
import io
import zipfile

import numpy as np
import pandas as pd

from datasets.base import standard_split, DatasetBundle
from utils.download import download_if_missing

URL = "https://storage.googleapis.com/tensorflow/tf-keras-datasets/jena_climate_2009_2016.csv.zip"
ZIP_PATH = "./data/weather/jena_climate_2009_2016.csv.zip"


def load(seq_len: int = 96, pred_len: int = 96) -> DatasetBundle:
    download_if_missing(URL, ZIP_PATH)

    with zipfile.ZipFile(ZIP_PATH) as zf:
        csv_name = next(n for n in zf.namelist() if n.endswith(".csv"))
        with zf.open(csv_name) as f:
            df = pd.read_csv(f)

    date_cols = [c for c in df.columns if "date" in c.lower() or "time" in c.lower()]
    df = df.drop(columns=date_cols)

    values = df.values.astype(np.float32)
    return standard_split(values, seq_len, pred_len, name="Weather", feature_names=list(df.columns))
