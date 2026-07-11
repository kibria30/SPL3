If you're learning time series forecasting (ARIMA, LSTM, Transformers, Temporal Fusion Transformer, PatchTST, TimesFM, etc.), these are some of the most commonly used datasets, ordered from easiest to more challenging.

## 1. Airline Passengers ⭐⭐⭐⭐⭐ (Best for beginners)

* **Samples:** 144 monthly observations
* **Task:** Predict monthly airline passengers
* **Frequency:** Monthly
* **Variables:** 1 (Univariate)

**Why it's famous**

* Used in almost every introductory time series textbook.
* Perfect for learning trend, seasonality, differencing, and ARIMA.

Example:

| Month   | Passengers |
| ------- | ---------- |
| 1949-01 | 112        |
| 1949-02 | 118        |
| ...     | ...        |

Download:

* [https://raw.githubusercontent.com/jbrownlee/Datasets/master/airline-passengers.csv](https://raw.githubusercontent.com/jbrownlee/Datasets/master/airline-passengers.csv)

---

## 2. Shampoo Sales ⭐⭐⭐⭐⭐

Only 36 observations.

Great for learning:

* ARIMA
* Exponential Smoothing
* Holt-Winters

Download:

* [https://raw.githubusercontent.com/jbrownlee/Datasets/master/shampoo.csv](https://raw.githubusercontent.com/jbrownlee/Datasets/master/shampoo.csv)

---

## 3. Daily Minimum Temperatures ⭐⭐⭐⭐⭐

* 3650 daily observations
* One variable
* Clean dataset

Perfect for:

* LSTM
* RNN
* GRU
* CNN-LSTM

Download:

* [https://raw.githubusercontent.com/jbrownlee/Datasets/master/daily-min-temperatures.csv](https://raw.githubusercontent.com/jbrownlee/Datasets/master/daily-min-temperatures.csv)

---

## 4. Monthly Sunspots ⭐⭐⭐⭐

Classic scientific dataset.

Contains:

* 270 years
* Monthly observations

Good for:

* Long-range forecasting
* Spectral analysis

Download:

* [https://raw.githubusercontent.com/jbrownlee/Datasets/master/monthly-sunspots.csv](https://raw.githubusercontent.com/jbrownlee/Datasets/master/monthly-sunspots.csv)

---

## 5. Electricity Load Diagrams (UCI) ⭐⭐⭐⭐⭐

Very popular in research.

Contains:

* Electricity usage
* Hundreds of customers
* Multivariate

Used for:

* LSTM
* TFT
* Informer
* Autoformer

---

## 6. Household Power Consumption ⭐⭐⭐⭐⭐

Very famous.

Contains:

* Voltage
* Current
* Active power
* Reactive power
* Energy consumption

Excellent for multivariate forecasting.

---

## 7. Beijing PM2.5 Dataset ⭐⭐⭐⭐⭐

One of the most used environmental datasets.

Variables:

* PM2.5
* Temperature
* Pressure
* Wind
* Humidity

Perfect for multivariate forecasting.

---

## 8. Weather Dataset (Jena Climate) ⭐⭐⭐⭐⭐

Google/TensorFlow tutorial dataset.

Contains:

* Temperature
* Pressure
* Humidity
* Wind
* Rain

Very clean.

---

## 9. M4 Competition Dataset ⭐⭐⭐⭐⭐

The benchmark dataset for forecasting.

Contains over **100,000** time series across:

* Yearly
* Quarterly
* Monthly
* Weekly
* Daily
* Hourly

Used by almost every forecasting paper.

---

## 10. M5 Forecasting Dataset ⭐⭐⭐⭐⭐

From Walmart.

Forecast:

* Product sales
* Multiple stores
* Multiple products

Large and realistic.

---

## 11. ETT (Electricity Transformer Temperature)

One of the most popular modern deep learning datasets.

Used by papers introducing:

* Informer
* Autoformer
* FEDformer
* PatchTST
* TimesNet

---

## 12. Exchange Rate Dataset

Forecast exchange rates among several currencies.

Common in transformer-based forecasting papers.

---

## 13. Traffic Dataset

Road occupancy data.

Used in:

* Informer
* Autoformer
* Crossformer
* iTransformer

---

## 14. Solar Energy Dataset

Forecast solar plant output.

Popular in renewable energy forecasting research.

---

## 15. NASDAQ / Stock Price Dataset

Examples:

* Apple
* Microsoft
* Google
* Tesla

Good for practicing financial forecasting, though stock prices are inherently noisy and difficult to predict.

---

# Best Kaggle Datasets

* Store Sales Forecasting
* Rossmann Store Sales
* Favorita Grocery Sales
* Walmart Recruiting Sales Forecasting
* Web Traffic Time Series Forecasting
* PJM Energy Consumption
* Bike Sharing Demand
* COVID-19 Time Series

---

# If you're interested in Deep Learning

Use these datasets:

| Dataset            | Difficulty | Multivariate | Research Popularity | Passed/Failed
| ------------------ | ---------- | ------------ | ------------------- | ------------------------
| Airline Passengers | ⭐          | ❌            | ⭐⭐⭐                 | Passed
| Daily Temperature  | ⭐          | ❌            | ⭐⭐⭐⭐                | Passed
| Beijing PM2.5      | ⭐⭐         | ✅            | ⭐⭐⭐⭐⭐               | Passed
| Jena Climate       | ⭐⭐         | ✅            | ⭐⭐⭐⭐⭐               | Failed
| Household Power    | ⭐⭐⭐        | ✅            | ⭐⭐⭐⭐⭐               | Passed
| ETT                | ⭐⭐⭐        | ✅            | ⭐⭐⭐⭐⭐               | Paused
| Electricity        | ⭐⭐⭐⭐       | ✅            | ⭐⭐⭐⭐⭐               | Pasued
| Traffic            | ⭐⭐⭐⭐       | ✅            | ⭐⭐⭐⭐⭐               |
| Exchange Rate      | ⭐⭐⭐⭐       | ✅            | ⭐⭐⭐⭐⭐               |
| M4                 | ⭐⭐⭐⭐       | Mixed        | ⭐⭐⭐⭐⭐               |
| M5                 | ⭐⭐⭐⭐⭐      | ✅            | ⭐⭐⭐⭐⭐               |

## My recommendation for a learning path

1. **Airline Passengers** → Learn preprocessing, ARIMA, and seasonality.
2. **Daily Minimum Temperatures** → Practice LSTM, GRU, and Transformer models.
3. **Jena Climate** or **Beijing PM2.5** → Move to multivariate forecasting.
4. **ETT** → Reproduce results from modern forecasting papers.
5. **M4** and **M5** → Benchmark advanced forecasting models.
6. **Electricity**, **Traffic**, and **Exchange Rate** → Explore state-of-the-art architectures like PatchTST, iTransformer, TimesNet, and Chronos.

This progression takes you from textbook examples to datasets commonly used in current time series forecasting research.
