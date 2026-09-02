Dataset: Hourly Anomaly Scores and Leak Labels from a Multi-Source Urban Water Distribution Network Dataset

Description:
This dataset includes hourly time series from an anonymized urban Water Distribution Network (WDN), combining SCADA sensor readings, operational energy usage, and environmental conditions. 
Anomaly scores were generated using Elastic ML and Isolation Forest algorithms. Binary labels indicate proximity (±7 days) to real leak events recorded in the PTIS system.

Columns:
- timestamp: DD-MM-YYYY HH:00 (datetime string)
- fault_d7: Binary leak proximity label (0/1) for ±7 days around known leak events
- *_kW, *_power_hour: Anomaly scores for energy consumption metrics from pumping stations
- *_ws_temp, *_ws_vigor, *_ws_level: Anomaly scores from SCADA-based water source sensors
- temp_site1_anomaly_score: Environmental temperature anomaly from site 1 (formerly Zikava)
- sfc_temp_site1_anomaly_score: Surface temperature anomaly from site 1
- gw_lvl_site2_anomaly_score: Groundwater level anomaly from site 2 (formerly Machulince)
- gw_temp_site2_anomaly_score: Groundwater temperature anomaly from site 2

All anomaly scores are on a 0–100 scale, where higher values indicate more statistically unusual readings. NULL values indicate sensor downtime or unavailable data.

License: CC-BY 4.0
DOI: 10.5281/zenodo.15096167
Contact: Jan Babela, Constantine the Philosopher University in Nitra, jan.babela@ukf.sk
