# Dataset Reference

Details of every dataset listed in the app's Datasets page: where it comes from, why it exists,
what a row and a column mean, and how it relates to the benchmark used in the DLinear paper
(Zeng et al., AAAI-23, `docs/Dlinear.pdf`).

Facts below are of two kinds. **Verified** facts were checked against the files in `backend/` and
the loader code. **Background** facts (who collected the data and why) come from the datasets'
public documentation as I know it, and were not re-checked online. Anything uncertain is marked.

| # | Dataset (UI name) | Type | Rows x vars | Frequency |
|---|---|---|---|---|
| 1 | ILI (CDC Influenza-Like Illness) | system | 966 x 7 | weekly |
| 2 | Traffic (California road occupancy) | system | 17,544 x 50 (of 862) | hourly |
| 3 | Weather (Live, Open-Meteo) | system | 26,304 x 4 | hourly |
| 4 | ILI monthly | user upload | 222 x 7 | monthly |
| 5 | Jena weather dataset monthly | user upload | 97 x 14 | monthly |
| 6 | Historic weekly rainfall 1975-2016 | user upload | 2,192 x 13 | weekly |

---

## 1. ILI (CDC Influenza-Like Illness) - system, weekly

**Source.** US Centers for Disease Control and Prevention (CDC), *ILINet*, the US Outpatient
Influenza-like Illness Surveillance Network. The app downloads the file `national_illness.csv`
from the scalation GitHub mirror (`backend/data/ili/national_illness.csv`). It is the same file the
LTSF benchmark (Informer, Autoformer, DLinear) uses.

**Why it exists.** Public-health authorities need an early signal of how much flu is circulating,
and when the season peaks. ILINet collects weekly reports from thousands of enrolled outpatient
clinics (doctors' offices, urgent care, ER departments) across all US states. "Influenza-like
illness" is a *symptom-based* case definition: fever (>= 100 F / 37.8 C) plus cough and/or sore
throat, with no known cause other than influenza. It is not a lab-confirmed flu count. CDC
uses it to track season onset, severity and peak timing, and to compare across seasons.

**Why it is a forecasting benchmark.** It has a strong yearly seasonality (winter peaks) but
highly variable peak heights between seasons, and it is short (966 weeks), so it tests models in
a low-data regime. That is why the LTSF papers use shorter horizons (24-60 weeks) for it.

**Rows.** One row = one week, 2002-01-01 to 2020-06-30 (966 rows, verified: all gaps are exactly
7 days, every date is a Tuesday). The date marks the week the report refers to.

**Columns (7 numeric channels + date).** The app drops `date` and forecasts all 7.

| Column | Meaning |
|---|---|
| `% WEIGHTED ILI` | Percentage of all patient visits that were for ILI, weighted by state population so big states count proportionally. CDC's headline number. |
| `%UNWEIGHTED ILI` | Same percentage with every reporting provider counted equally. Verified: equals `ILITOTAL / OT * 100`. |
| `AGE 0-4` | Count of ILI patients aged 0-4 that week. |
| `AGE 5-24` | Count of ILI patients aged 5-24 that week. (The older age groups 25-49, 50-64, 65+ are not in the file, so these two do not add up to `ILITOTAL`.) |
| `ILITOTAL` | Total number of ILI patients across all ages. |
| `NUM. OF PROVIDERS` | Number of clinics that reported that week. It changes over time as the network grew (754 in 2002, about 3,000 in 2020). |
| `OT` | Total number of patient visits seen (the denominator of the percentage columns). "OT" is the "other/total" column in the original CDC download. |

**Things to know.**
- The columns are strongly correlated (counts all rise with the epidemic), so the 7 variables are
  not 7 independent signals.
- `NUM. OF PROVIDERS` and `OT` are not disease measures. They grow with network enrolment, so they
  contain a long-term upward trend unrelated to flu.
- Paper Table 1 lists the same dataset: 7 variates, 966 steps, 1 week. The app and the paper match.
- Not stationary across seasons: 2009 (H1N1 pandemic) and 2020 (COVID) distort the pattern.

---

## 2. Traffic (California road occupancy) - system, hourly

**Source.** California Department of Transportation (Caltrans) **PeMS**, the Performance
Measurement System. The compiled version is from Lai et al., *Modeling Long- and Short-Term
Temporal Patterns with Deep Neural Networks* (LSTNet, SIGIR 2018), distributed as
`traffic.txt.gz` in `laiguokun/multivariate-time-series-data` (`backend/data/traffic/traffic.txt.gz`).
Again, the same file the LTSF benchmarks use.

**Why it exists.** PeMS gathers real-time data from roughly 40,000 inductive-loop detectors and
other sensors embedded in California freeways. Caltrans uses it to monitor congestion, measure
freeway performance, and plan road capacity. The LSTNet authors took one hourly slice of it
(2015-2016, San Francisco Bay Area freeways) to test multivariate forecasting where many series
share daily and weekly rhythms.

**Rows.** One row = one hour. 17,544 rows = 731 days x 24 hours (verified), i.e. 2015-01-01 to
2016-12-31 (2016 is a leap year). **The file has no header and no timestamp column**; the app
loads it with `header=None`, so the time axis is implied by row order only.

**Columns.** 862 columns, one per sensor/lane location. Each value is the **road occupancy rate**:
the fraction of time (0 to 1) the sensor was covered by a vehicle during that hour. High occupancy
means congestion. It is a proxy for traffic load, not a vehicle count or speed. Column identity
(which road or exit) is not stored in the file; only the column index remains.

**What the app does.** To keep attention models and Tensor-AR tractable it keeps only the **first
50 of 862 sensors** (`max_vars=50`). Verified mean occupancy over those 50 is about 0.059.
The paper evaluates on all 862.

**Things to know.**
- Very regular: strong 24-hour cycle (rush hours), clear weekday/weekend 168-hour cycle. That is
  why `period_len = 24` works well.
- Sensors are spatially related (neighbouring sensors rise and fall together), but DLinear with
  shared weights does not model that.
- Paper Table 1: 862 variates, 17,544 steps, 1 hour. Series length matches, variable count does not.

---

## 3. Weather (Live, Open-Meteo) - system, hourly

**Source.** The Open-Meteo Historical Weather API
(`archive-api.open-meteo.com/v1/archive`, free, no API key). Open-Meteo serves reanalysis data
(mainly ECMWF's ERA5 family), i.e. a physics model blended with observations on a global grid.
It is **not** raw station telemetry. Cached files live in `backend/data/live_weather/`.

**Why it exists in this project.** To have a live, local, Bangladesh-relevant dataset rather than
only the standard benchmark files. The default location is **Dhaka (23.8103 N, 90.4125 E)**, over a rolling ~3 years
ending two days ago (the archive's ingestion lag). The date range moves when you rerun it on a
later day.

**Rows.** One row = one hour. 26,304 rows = 1,096 days x 24 (verified), 2023-08-01 to 2026-07-31.

**Columns.**

| Column | Unit | Meaning |
|---|---|---|
| `temperature_2m` | degC | Air temperature 2 m above ground. Verified range 8.9-40.9, mean 26.1. |
| `relative_humidity_2m` | % | Relative humidity at 2 m. |
| `precipitation` | mm | Rain (plus melted snow) falling in the preceding hour. Mostly 0 with sparse spikes (max 20.9, mean 0.20). |
| `wind_speed_10m` | km/h (API default) | Wind speed 10 m above ground. |

The loader linearly interpolates any missing values. The `time` column is dropped before forecasting.

**Things to know.**
- Not the benchmark "Weather" dataset (see section 5 for the Jena comparison). Different
  place, source, variables and length, so paper numbers do not apply.
- `precipitation` is intermittent and heavy-tailed, so it is hard to forecast and dominates MSE
  when z-scored (a rare large spike becomes a large normalized value).
- Because the window is rolling, a result today is on slightly different data than the same
  experiment next week.

---

## 4. ILI monthly - user upload, 222 rows

Derived from dataset 1 by the user, aggregated from weekly to monthly. Same 7 columns and same
date range (2002-01-31 to 2020-06-30, month-end dates).

**Data-quality problem (verified).** The percentage and provider columns look **summed over the
weeks of a month instead of averaged**. Example, January 2002:

| | `% WEIGHTED ILI` | `ILITOTAL` |
|---|---|---|
| Monthly file | 6.842 | 12,009 |
| Sum of weekly rows | 6.842 | 12,009 |
| Mean of weekly rows | 1.368 | 2,402 |

Counts (`ILITOTAL`, `AGE ...`, `OT`) are legitimately sums. But a *percentage* summed over 4-5
weeks is meaningless (6.8% ILI would be an epidemic; the real value was about 1.4%), and the sum
also depends on whether the month has 4 or 5 weeks. `NUM. OF PROVIDERS` summed is "provider-weeks",
not providers. Recommendation: recompute `% WEIGHTED ILI` and `%UNWEIGHTED ILI` as `ILITOTAL / OT`
(or a mean), and take the mean for `NUM. OF PROVIDERS`, then rerun any experiment that used this file.

**Other limit.** 222 rows means about 18 yearly cycles; a 3-year test window leaves about 15 years to train on,
and a monthly seasonal period is 12.

---

## 5. Jena weather dataset monthly - user upload, 97 rows

**Source.** The **Jena Climate** dataset recorded at the weather station of the **Max Planck
Institute for Biogeochemistry, Jena, Germany**. It is widely distributed on Kaggle and used in the
TensorFlow/Keras time-series tutorial as `jena_climate_2009_2016.csv`. Original file: 420,551 rows x
14 variables, one reading every **10 minutes**, 2009-01-01 to 2016-12-31 (this repo's
`experiment/README.md` records the same shape).

**Why it exists.** The institute's meteorological station records atmospheric conditions as part of
climate and biogeochemistry research (heat, water vapour and gas exchange between the atmosphere and the
land surface). It is a long, clean, multi-variable record, which made it a popular benchmark for
multivariate forecasting.

**Rows (this file).** One row = one calendar month, `Date Time` = first of the month, 2009-01-01 to
2017-01-01 (97 rows). The values are **monthly means of the 10-minute readings** (Jan 2009 pressure
988.99 mbar is a mean). **The last row (2017-01-01) has 2-decimal values like the raw file, so it is
probably a single raw reading, not a monthly mean.** It is an artifact of aggregating a file that
ends at the first reading of 2017; treat that row as suspect or drop it.

**Columns (14 channels).**

| Column | Unit | Meaning |
|---|---|---|
| `p (mbar)` | mbar | Atmospheric pressure |
| `T (degC)` | degC | Air temperature |
| `Tpot (K)` | K | Potential temperature: the temperature the air would have if brought to a standard pressure (1000 mbar). Removes the effect of altitude/pressure. |
| `Tdew (degC)` | degC | Dew point: the temperature at which the air becomes saturated with water vapour |
| `rh (%)` | % | Relative humidity |
| `VPmax (mbar)` | mbar | Saturation vapour pressure: the most water vapour the air can hold at that temperature |
| `VPact (mbar)` | mbar | Actual vapour pressure: the water vapour actually present |
| `VPdef (mbar)` | mbar | Vapour-pressure deficit = `VPmax - VPact` (dryness of the air) |
| `sh (g/kg)` | g/kg | Specific humidity: grams of water vapour per kg of air |
| `H2OC (mmol/mol)` | mmol/mol | Water-vapour concentration |
| `rho (g/m**3)` | g/m3 | Air density |
| `wv (m/s)` | m/s | Wind speed |
| `max. wv (m/s)` | m/s | Maximum wind speed (gust) in the interval |
| `wd (deg)` | degrees | Wind direction (0-360) |

**Things to know.**
- Many columns are derived from each other (`VPmax` from `T`; `VPact` from `rh` and `VPmax`; `VPdef`
  from both; `sh`, `H2OC`, `Tdew` from vapour pressure; `Tpot` and `rho` from `T` and `p`). The 14
  channels carry far fewer than 14 independent signals, which flatters multivariate models
  and makes the channels highly correlated.
- `wd` is an angle: 359 and 1 degrees are neighbours, but a plain average or MSE treats them as far apart.
  Averaging wind direction by simple mean is also not physically correct.
- **Not the paper's Weather dataset.** The LTSF/DLinear "Weather" set is *also* from the Jena station,
  but a different year (2020), with **21** indicators at 10-minute resolution and 52,696 rows. Your file
  is the 2009-2016 version, 14 variables, aggregated about 4,000 times coarser, so paper numbers for Weather cannot be compared.
- Only 97 rows, about 8 yearly cycles. That is why the Jena monthly experiments can only train a few
  periods (`experiment/README.md`: train 5 / test 3 periods).

---

## 6. Historic weekly rainfall 1975-2016 - user upload

**Source.** Not recorded in the repo. The file is `cleaned_weekly_rainfall_data_1975_to_2016.csv`,
cleaned by the user (see `experiment/historic_rainfall_bd/dataset_building.ipynb`). The station
names are Bangladeshi weather stations, so the original is presumably from the Bangladesh
Meteorological Department (BMD), but **I could not verify this, so confirm the provenance and cite
it before using the data in the report.**

**Rows.** One row = one week. 2,192 rows = 42 years x 52 weeks (1975-2016). The file uses `year` and
`week` columns (week 1-52) instead of a date; 52 weeks per year means days 365/366 are folded in.

**Columns.** `year`, `week` (identifiers, dropped for forecasting unless kept) and 13 station
columns: Barisal, Bhola, Bogra, CoxsBazar, Dhaka, Faridpur, Ishurdi, Mymensingh, Rajshahi, Rangamati,
Rangpur, Satkhira, Sylhet. Each value is the rainfall at that station for that week, presumably in
mm (unit not stated in the file).

**Things to know.**
- Strong monsoon seasonality (June-September) with many zero weeks in the dry season, so the
  distribution is very skewed and many zeros make sMAPE/MASE unstable.
- Weekly period 52 gives 42 yearly cycles, good for Tensor-AR's period-by-time tensor.
- The two uploads in the same folder (monthly version, `experiment/README.md` lists
  `cleaned_monthly_rainfall_1975_to_2016.csv`) come from the same source at a coarser step.

---

## Summary comparison with the DLinear paper (Table 1)

| Dataset | Paper | This app | Comparable? |
|---|---|---|---|
| ILI | 7 var, 966 steps, weekly | identical file | Yes (data), not (protocol) |
| Traffic | 862 var, 17,544 steps, hourly | 50 of 862 var | Partly |
| Weather | 21 var, 52,696 steps, 10 min (Jena 2020) | 4 var, 26,304 steps, hourly (Dhaka, ERA5) | No |
| Jena monthly | (same station as paper Weather, other year) | 14 var, 97 monthly rows | No |
| ILI monthly | not in paper | 222 rows, **summed percentages** | n/a, fix first |
| Rainfall | not in paper | 13 stations, weekly | n/a |

Protocol differences (single test window vs. averaged sliding windows, different split and lookback)
are explained in the earlier discussion and apply to every row above.
