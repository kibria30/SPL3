# Best time series type for our pipelie
- hourly timestamp
- tensor(dayXhourXfeature) ---> (25x24x4)

# PowerCast type forecasting working well on datasets:
## (Working well in Hourly/monthly frequency data)

## Univariate Dataset
- Airline Passengers
- Daily Minimum Temperatures
- Hourly and monthly timeseries dataset of M4 dataaset

## Multivariate Dataset
- Household Power Consumption(works well. Now need to compare with LSTM)
- Beijing PM2.5 Dataset



# PowerCast type forecasting fail:
## (Not working well in daily frequency data)

## Univariate Dataset
- Monthly Sunspots
- Exchange Rate Dataset

## Multivariate Dataset
- Weather Dataset (Jena Climate)
- Exchange Rate Dataset

