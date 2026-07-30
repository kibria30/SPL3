"""Beijing PM2.5.

Hourly air-quality/weather readings from the Beijing US Embassy station, 2010-2014 (the UCI
"Beijing PM2.5" set: Liang et al. 2015), auto-downloaded. Same source and columns as the user's
own exploratory notebook (`Experiment-Passed/beijing_weather_cast.ipynb`): `pm2.5`, `DEWP`
(dew point), `TEMP`, `PRES`, `Iws` (cumulated wind speed). `cbwd` (categorical wind direction),
`Is`/`Ir` (cumulated snow/rain hours -- mostly zero, low information) and the `No`/calendar
columns are dropped, matching that notebook.

Unlike the notebook -- which aggregates to one row per day before decomposing -- this loader
keeps the native hourly granularity (consistent with how `weather.py`/`traffic.py` keep their
native granularity rather than resampling), so `tensor_period=24` is an hourly day-cycle, not a
day-of-year cycle. `pm2.5` has ~5% missing values (sensor gaps); unlike the notebook, which drops
the column entirely to sidestep this, this loader keeps it (it's the dataset's headline variable)
and linearly interpolates the gaps, since `standard_split()`/StandardScaler can't handle NaNs.
"""
import numpy as np
import pandas as pd

from datasets.base import standard_split, DatasetBundle
from utils.download import download_if_missing

URL = "https://archive.ics.uci.edu/ml/machine-learning-databases/00381/PRSA_data_2010.1.1-2014.12.31.csv"
PATH = "./data/beijing/PRSA_data_2010.1.1-2014.12.31.csv"

FEATURE_COLUMNS = ["pm2.5", "DEWP", "TEMP", "PRES", "Iws"]


def load(seq_len: int = 96, pred_len: int = 96) -> DatasetBundle:
    download_if_missing(URL, PATH)

    df = pd.read_csv(PATH)
    df = df[FEATURE_COLUMNS]
    df = df.interpolate(method="linear", limit_direction="both")

    values = df.values.astype(np.float32)
    return standard_split(values, seq_len, pred_len, name="Beijing", feature_names=FEATURE_COLUMNS)
