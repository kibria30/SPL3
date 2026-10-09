# TensorAR Forecasting Pipeline — No ML/DL Model

Motivated by **PowerCast: Mining and Forecasting Power Grid Sequences** (`powercast.pdf`, Sec 3.1, Sec 4.3).
Same idea: `Seq2Tensor -> CP decomposition -> extend 1st mode (AR) -> reconstruct`.

> Forecast by extending latent time factors and reconstructing, not by training a neural net.

## 1. Pipeline

### Step 1 — Preprocess
* Parse `Date Time`, sort, set index.
* `group_by_hour / day / month`: `resample("1h"/"1D"/"MS").mean()` only if native resolution is finer.
* `StandardScaler` on all feature columns.
* Keep `df_raw` copy for inverse-scale plotting.

Example `demonstration_mid/weather_cast.ipynb`:
```
jena_climate_2009_2016.csv (420551, 15) 10-min
-> monthly (97, 14)
-> df = monthly[:8*12] (96, 14) = 8 years x 12 months
```

### Step 2 — Tensor forming
```python
TOTAL_POINTS = len(df)          # 96
PERIOD = 8                      # years (= days in PowerCast notation)
TIME = TOTAL_POINTS // PERIOD   # 12 months-in-year
FEATURES = len(df.columns)      # 14
tensor = df.values.reshape(PERIOD, TIME, FEATURES)  # (8,12,14)
train_tensor = tensor[:5]  # (5,12,14)
test_tensor  = tensor[5:8] # (3,12,14)
```
Mode-0 = long-term (year/day), Mode-1 = intra-period (month/hour), Mode-2 = variables.

### Step 3 — Tensor decomposition (CP/PARAFAC)
```python
from tensorly.decomposition import parafac
weights, (A,B,C) = parafac(train_tensor, rank=2, normalize_factors=True)
# A: (5,2) day/year factors, B: (12,2) time factors, C: (14,2) feature factors
# train ≈ sum_r w[r] * A[:,r] ⊗ B[:,r] ⊗ C[:,r]
reconstructed = cp_to_tensor((weights, factors))
```
`B` = seasonal shape, `C` = inter-variable coupling, assumed stationary. Only `A` evolves.

### Step 4 — Extend 1st dimension + reconstruct = forecast
```python
from statsmodels.tsa.ar_model import AutoReg
forecast_A = zeros((3,2))
for r in range(2):
    fit = AutoReg(A[:,r], lags=1).fit()
    forecast_A[:,r] = fit.forecast(steps=3)

forecast_tensor = zeros((3,12,14))
for i in range(3):
    for r in range(2):
        forecast_tensor[i] += weights[r] * outer(forecast_A[i,r]*B[:,r], C[:,r])
```
No gradient training. `B,C,w` frozen, `AR(1)` extrapolates latent trend.

### Step 5 — Evaluate
Flatten to series, plot `Actual (k-) vs Forecast (r--)`, per-feature `R2 / MSE / MAE / RMSE` (`sklearn.metrics`).

Key properties (`observation.md`):
* short-term forecasting
* train/test are not separate learning phases — direct observation-based extrapolation

## 2. Forecasting work in this repo

| Notebook | Data | Tensor |
|---|---|---|
| `demonstration_mid/weather_cast.ipynb` | Jena Climate `jena_climate_2009_2016.csv` monthly | `(8,12,14)`, train 5 / test 3, R=2 |
| `demonstration_mid/LiveWeatherCast.ipynb`, `v2.ipynb` | Live weather API dump, 25 periods | `(25,TIME,F)`, R=2 / rank-search in v2 |
| `demonstration_mid/traffic.ipynb` | `tsf_compare/data/traffic/traffic_with_date.csv` | `(25,TIME,F)`, split by ratio, R=2 |
| `historic_rainfall_bd/monthly_rainfall_cast.ipynb` | `cleaned_monthly_rainfall_1975_to_2016.csv` | `(25,12,13)`, train 20 / test 5 |
| `historic_rainfall_bd/weekly_rainfall_cast.ipynb` | `cleaned_weekly_rainfall_1975_to_2016.csv` | `(25,52,13)`, train 20 / test 5 |
| `demonstration_mid/ILI_cast.ipynb`, `ILI_cast_monthly.ipynb` | `national_illness.csv` / `ILI_cases_monthly.csv` | `(18,TIME,F)`, train `ceil(PERIOD*ratio)` |
| `etth1_cast.ipynb`, `Exchange_cast.ipynb`, `S&P_cast.ipynb`, `DLinear_*M4.ipynb` | ETT / Exchange / S&P / M4 | baselines vs DLinear |

Findings (`Result.md`):
* Works well: hourly/monthly frequency, `day x hour x feature` e.g. `(25,24,4)` — Airline, Daily-Temp, M4 hourly/monthly, Household Power, Beijing PM2.5.
* Fails: daily frequency — Monthly Sunspots, Exchange Rate, Jena daily.

## 3. Run
```
pip install numpy pandas matplotlib scikit-learn tensorly statsmodels
```
Open any `*_cast.ipynb`, set `PERIOD/TRAIN_DAYS/TEST_DAYS/R`, run top to bottom.

## 4. Next: anomaly detection
Same forecast, PowerCast Sec 4.3 style: `score = |test_tensor - forecast_tensor|`, threshold from `|train - reconstructed|`, flag `argmax` deviation. See `anomaly_exp/` (GECCO) and `powercast.pdf` Fig.6.
