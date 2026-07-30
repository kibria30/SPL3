"""Exchange-Rate.

Daily FX rates of 8 countries, 1990-2016, from the original LSTNet/laiguokun release -- the
same source the LTSF benchmark papers use. Near-random-walk dynamics with weak/no clean
periodicity, which makes it the "tough test" of the five datasets here: in the DLinear paper
this is the one benchmark where a naive repeat-last-value baseline beats every Transformer.
"""
import gzip

import numpy as np
import pandas as pd

from datasets.base import standard_split, DatasetBundle
from utils.download import download_if_missing

URL = "https://raw.githubusercontent.com/laiguokun/multivariate-time-series-data/master/exchange_rate/exchange_rate.txt.gz"
PATH = "./data/exchange/exchange_rate.txt.gz"


def load(seq_len: int = 96, pred_len: int = 96) -> DatasetBundle:
    download_if_missing(URL, PATH)

    with gzip.open(PATH, "rt") as f:
        df = pd.read_csv(f, header=None)

    values = df.values.astype(np.float32)
    return standard_split(values, seq_len, pred_len, name="Exchange")
