# Comparison: `x_y_cast.ipynb` vs `I_V_cast.ipynb`

## At a Glance

| Aspect | `x_y_cast.ipynb` | `I_V_cast.ipynb` |
|---|---|---|
| **Data** | `synthetic_worker_motion.csv` (58880×3: time, x, y) | `int3_data_converted.csv` (671×4: I_real, I_imag, V_real, V_imag) |
| **Domain** | Synthetic 2D worker position tracking | Real electrical phasor measurements (current/voltage) |
| **Tensor shape** | 256 days × 230 time steps × 2 features | 27 days × 24 time steps × 4 features |
| **Train/Test** | 115 / 141 days | 21 / 6 days |
| **Forecast horizon** | 2 days | 6 days |

## Key Differences

### 1. Feature Engineering
| | `x_y_cast` | `I_V_cast` |
|---|---|---|
| **Tensor features** | Raw (x, y) coordinates | Physical params: G (conductance), alpha_r, B (susceptance), alpha_i |
| **Conversion** | None — direct reshape | Sliding-window weighted linear fit of I vs V, extracting slope (G/B) and intercept (alpha) |
| **Rationale** | N/A — positions are directly interpretable | Isolates underlying electrical properties from raw V/I; reduces noise via Gaussian-weighted windowing |

### 2. Noise Processing
| | `x_y_cast` | `I_V_cast` |
|---|---|---|
| **Smoothing** | None | `gaussian_filter1d(sigma=0.5)` on each raw signal column |
| **Windowing** | None | Gaussian-weighted local window (size=5, sigma=0.5) during linear fit |
| **Effect** | Raw data goes directly into tensor | Measurement noise is attenuated before decomposition |

### 3. Pipeline Completeness
| | `x_y_cast` | `I_V_cast` |
|---|---|---|
| **Anomaly detection** | ✗ (visual comparison only) | ✓ (relative error threshold=0.2, flagged points) |
| **Inverse transform** | N/A (features already interpretable) | ✓ Converts forecasted (G, B, alpha) back to I_real, I_imag for physical interpretation |
| **Error metrics** | ✗ | ✓ NRMSE-like relative error, total error plot |
| **Autoregressive model** | AR(1) via statsmodels | AR(1) via statsmodels |

### 4. Data Scale
| | `x_y_cast` | `I_V_cast` |
|---|---|---|
| **Total points** | 58,880 | 671 |
| **Points per day** | 230 (high resolution, ~6.4 Hz) | 24 (hourly samples) |
| **Tensor size** | (256, 230, 2) = 117,760 elements | (27, 24, 4) = 2,592 elements |
| **Dataset type** | Synthetic motion trace | Real CMU electrical load monitoring |

## Similarities

1. **Core algorithm**: Both use CP/PARAFAC decomposition (rank R=2) followed by AR(1) forecasting on day-factor matrix
2. **Library**: Both use `tensorly.parafac` and `statsmodels.AutoReg`
3. **Train/test split**: Both use early days for training, later days for testing
4. **Reconstruction**: Both reconstruct forecast tensor via outer product of (forecasted day factors × time factors × feature factors)
5. **Visualization**: Both plot actual vs forecasted time series with day separators

## Summary

`x_y_cast.ipynb` is a lightweight, high-resolution synthetic position forecasting notebook — quick to run, directly interpretable, but lacks noise handling and anomaly detection.

`I_V_cast.ipynb` is a more complete pipeline for real electrical data: it includes physics-guided feature extraction (sliding-window linear fit extracts conductance/susceptance), Gaussian noise reduction, full anomaly detection with configurable thresholding, and back-conversion to raw I/V for interpretability. The trade-off is higher complexity and smaller dataset (27 daily cycles vs 256).
