# Comparison: `I_V_cast.ipynb` (Python) vs `PowerCast/anomaly_detection.m` (MATLAB)

## Similarities

- **Core algorithm**: Both use CP/PARAFAC tensor decomposition (rank-2) followed by autoregressive forecasting on the day-factor matrix.
- **Data shape**: Both operate on a 3D tensor of shape `(days, 24 hours, 4 features)`.
- **Train/test split**: Both train on historical days and forecast unseen future days.
- **Forecast method**: Both fit an autoregressive model (AR with lag=1 or configurable) independently per rank component on day factors, then reconstruct the full tensor.

## Key Differences

| Aspect | `I_V_cast.ipynb` (Python) | `anomaly_detection.m` (MATLAB) |
|---|---|---|
| **Tensor construction** | Direct reshape of raw I/V columns into a tensor (`I_real`, `I_imag`, `V_real`, `V_imag`) | Physical model: sliding-window linear fit extracts conductance `G`, susceptance `B`, and intercepts `alpha_r`, `alpha_i` from V/I pairs |
| **Tensor content** | Raw current/voltage phasors | Electrical parameters (G, B, alpha_r, alpha_i) inferred via linear regression |
| **Decomposition library** | `tensorly` (Python) | `tensor_toolbox` (MATLAB, v2.6) |
| **AR implementation** | `statsmodels.tsa.ar_model.AutoReg` | Manual OLS (`X\y`) with a lag matrix |
| **Forecast horizon** | Fixed: 6 days ahead | Configurable `n_d_pred` (e.g., 2–6) |
| **Inverse transform** | Not needed (forecasts directly in I/V space) | `tensor2data()` converts (G,B,alpha) back to I_real/I_imag using the physical model |
| **Anomaly detection** | None (stops at visual plot) | Relative error threshold (`cutoff_val=0.2`) on forecast vs actual; plots shaded anomaly regions |
| **Error metric** | Visual comparison only | Normalized RMSE (`computeErr`) |
| **Seasonal variant** | No | Supports `tensor_SAR` (seasonal AR with weekly period) |
| **Noise handling** | None | `sigma` and `window_size` parameters control sliding-window smoothing |
| **Code maturity** | Exploratory notebook, single dataset | Modular functions, multiple datasets (CMU, LBNL), parameterized experiments |

## Strengths and Weaknesses

### `I_V_cast.ipynb` Strengths
- **Simplicity**: Direct reshape is easy to understand and implement.
- **Prototyping speed**: Jupyter notebook with immediate visual feedback.
- **Library quality**: Uses well-maintained libraries (`statsmodels`, `tensorly`).

### `I_V_cast.ipynb` Weaknesses
- **No physical grounding**: Raw I/V values mix multiple physical effects; the decomposition may capture noise rather than meaningful latent structure.
- **No anomaly detection**: Quantitative error analysis is missing; no threshold-based flagging.
- **No noise preprocessing**: The sliding-window fitting in the MATLAB version acts as a denoising step.
- **Fixed hyperparameters**: Dataset-specific constants (27 days, 24 hours) are hard-coded.
- **No modularity**: All logic is in one notebook; not reusable for other datasets.

### `anomaly_detection.m` Strengths
- **Physics-informed features**: Linear fitting extracts meaningful electrical parameters (conductance, susceptance), making decomposition more interpretable.
- **Complete pipeline**: End-to-end from raw data to anomaly detection with quantitative error metrics.
- **Robustness**: Sliding-window fitting with `sigma`/`window_size` handles measurement noise.
- **Flexibility**: Parameterized for multiple datasets (CMU, LBNL), configurable forecast horizon, AR/Seasonal-AR options.
- **Reproducible**: Fixed random seed (`rngseed = 1`).

### `anomaly_detection.m` Weaknesses
- **MATLAB dependency**: Requires proprietary MATLAB + Tensor Toolbox; harder to distribute or integrate.
- **Complexity**: 6 helper files, external library dependency; steeper learning curve.
- **AR implementation**: Manual OLS without statistical diagnostics (no AIC/BIC for lag selection, no stationarity checks).
- **No uncertainty quantification**: Point forecasts only; no confidence intervals for anomaly flags.

## Conclusion

`I_V_cast.ipynb` is a quick, visual prototype of tensor AR forecasting on raw I/V data, suitable for exploration. `PowerCast` is a more mature, physics-guided pipeline designed for robust anomaly detection across multiple power datasets. The Python notebook could be improved by adopting the physical tensor construction and error-thresholding from the MATLAB version.
