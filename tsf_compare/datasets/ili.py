"""ILI (Influenza-Like Illness).

Weekly national ILI surveillance data (CDC ILINet), from a public GitHub mirror named
`national_illness.csv` matching the standard LTSF benchmark's filename. Only numeric columns
are kept (any date/region text column is dropped automatically). This is the smallest dataset
of the five -- default seq_len/pred_len are shorter than the other datasets to match the
horizons used for ILI in the literature (24-60, not 96-720).
"""
import numpy as np
import pandas as pd

from datasets.base import standard_split, DatasetBundle
from utils.download import download_if_missing

URL = "https://raw.githubusercontent.com/scalation/data/master/Influenza/national_illness.csv"
PATH = "./data/ili/national_illness.csv"


def load(seq_len: int = 36, pred_len: int = 24) -> DatasetBundle:
    download_if_missing(URL, PATH)

    df = pd.read_csv(PATH)
    numeric_df = df.select_dtypes(include=[np.number])

    values = numeric_df.values.astype(np.float32)
    return standard_split(values, seq_len, pred_len, name="ILI", feature_names=list(numeric_df.columns))
