"""PEMS (California highway sensor network -- PEMS03/04/07/08).

Unlike the other four datasets, PEMS isn't hosted on a stable public HTTP mirror -- the
STSGCN/ASTGCN/TimesNet papers distribute it as a `.npz` file via Google Drive / Baidu Netdisk.
This loader expects you to have downloaded one variant yourself and placed it locally; it
raises a clear error with instructions if the file isn't found, rather than guessing at a URL
that might silently 404 or point at the wrong data.

Expected format: an `.npz` with a `data` array of shape (timesteps, num_sensors, num_features)
-- only the first feature (traffic flow) is used here, matching how PEMS is typically used as a
univariate-per-sensor multivariate benchmark in the LTSF literature. PEMS is also evaluated
short-horizon there (pred_len=12 is standard) unlike the other four datasets' 96+ horizons --
see config.py.
"""
import os

import numpy as np

from datasets.base import standard_split, DatasetBundle

DEFAULT_PATH = "./data/pems/PEMS08.npz"


def load(seq_len: int = 96, pred_len: int = 12, path: str = DEFAULT_PATH, max_vars: int = None) -> DatasetBundle:
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"PEMS data not found at {path}.\n"
            "PEMS (03/04/07/08) has no stable public HTTP mirror -- download one variant "
            "manually (search 'PEMS08.npz STSGCN' or 'ASTGCN PEMS dataset') and place it at "
            f"{path}, or pass path=... to load(). Expected an .npz with key 'data' of shape "
            "(timesteps, num_sensors, num_features)."
        )

    raw = np.load(path)["data"]           # (T, N, C)
    values = raw[:, :, 0].astype(np.float32)   # keep the flow channel only
    if max_vars is not None:
        values = values[:, :max_vars]

    return standard_split(values, seq_len, pred_len, name="PEMS")
