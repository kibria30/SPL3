"""Central place to declare which datasets and models participate in the comparison,
and their hyperparameters. Edit this file to change what `main.py` runs -- no need to
touch main.py itself for routine changes.
"""

# seq_len: input window length, in the dataset's native time step (e.g. hourly for Traffic,
#   10-min for Weather). Fixed per dataset -- only pred_len is swept.
# pred_lens: the forecast horizons to evaluate, one full train+eval pass per value (matching
#   how the LTSF papers report a curve across horizons rather than a single number). A model
#   is retrained from scratch for each horizon, since pred_len is baked into its output layer.
# tensor_period: the period length Tensor-AR reshapes the series by (its (PERIOD, TIME,
#   FEATURES) tensor uses TIME=tensor_period). Chosen as the most natural cycle length
#   for that dataset's granularity -- see each dataset's docstring for the reasoning.
# loader_kwargs: extra keyword arguments forwarded to that dataset's load() function.
DATASETS = {
    "weather": {
        "module": "datasets.weather",
        "seq_len": 96,
        "pred_lens": [96, 192, 336, 720],
        "tensor_period": 144,  # 10-min data -> 144 steps/day
    },
    "traffic": {
        "module": "datasets.traffic",
        "seq_len": 96,
        "pred_lens": [96, 192, 336, 720],
        "tensor_period": 24,  # hourly data -> 24 steps/day
        "loader_kwargs": {"max_vars": 50},  # 862 sensors total; subsample for tractable attention/CP cost
    },
    "ili": {
        "module": "datasets.ili",
        "seq_len": 36,
        "pred_lens": [24, 36, 48, 60],
        "tensor_period": 52,  # weekly data -> ~52 steps/year
    },
    "exchange": {
        "module": "datasets.exchange",
        "seq_len": 96,
        "pred_lens": [96, 192, 336, 720],
        "tensor_period": 7,  # daily data -> weak weekly cycle (see datasets/exchange.py)
    },
    "pems": {
        "module": "datasets.pems",
        "seq_len": 96,
        "pred_lens": [12],  # PEMS uses a single fixed short horizon in the literature, unlike the other four
        "tensor_period": 288,  # 5-min data -> 288 steps/day
        "loader_kwargs": {"max_vars": 50},
    },
    "beijing": {
        "module": "datasets.beijing",
        "seq_len": 96,
        "pred_lens": [96, 192, 336, 720],
        "tensor_period": 24,  # hourly data -> 24 steps/day
    },
    "live_weather": {
        "module": "datasets.live_weather",
        "seq_len": 96,
        "pred_lens": [96, 192, 336, 720],
        "tensor_period": 24,  # hourly data -> 24 steps/day
    },
}

# Order here is also the legend order in plots and the row order in per-dataset summaries.
# Grouped by family: tensor_ar/sarima/ets are the classical fit-once-and-extrapolate family
# (see models/tensor_ar.py's docstring); dlinear/itransformer/timexer/timemixer are the
# gradient-trained seq_len->pred_len regressor family.
MODELS = ["tensor_ar", "sarima", "ets", "dlinear", "itransformer", "timexer", "timemixer"]

# Shared training hyperparameters for the four gradient-trained models.
TRAIN_KWARGS = {"epochs": 100, "lr": 1e-3, "batch_size": 64, "patience": 5}

OUTPUT_DIR = "./outputs"
