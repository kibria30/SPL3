"""Traffic.

862 California road-occupancy sensors, hourly, from the original LSTNet/laiguokun release --
the same source the LTSF benchmark papers use. Full 862-variate attention (iTransformer,
TimeXer) and CP decomposition (Tensor-AR) get expensive fast, so `max_vars` subsamples the
first N sensor columns by default (see config.py). Pass `max_vars=None` for the full dataset.
"""
import gzip

import numpy as np
import pandas as pd

from datasets.base import standard_split, DatasetBundle
from utils.download import download_if_missing

URL = "https://raw.githubusercontent.com/laiguokun/multivariate-time-series-data/master/traffic/traffic.txt.gz"
PATH = "./data/traffic/traffic.txt.gz"


def load(seq_len: int = 96, pred_len: int = 96, max_vars: int = None) -> DatasetBundle:
    download_if_missing(URL, PATH)

    with gzip.open(PATH, "rt") as f:
        df = pd.read_csv(f, header=None)

    values = df.values.astype(np.float32)
    if max_vars is not None:
        values = values[:, :max_vars]

    return standard_split(values, seq_len, pred_len, name="Traffic")
