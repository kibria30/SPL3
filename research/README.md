# Research & documentation

Everything here is analysis/scratch work and documentation — **not needed to run the app** (the app is `backend/` + `frontend/`).

| Folder | Contents |
|---|---|
| `docs/` | `technical_report.md` (best overview of the app's design), datasets/anomaly-scope notes, drawio diagrams in `docs/diagrams/` |
| `experiment/` | Main experiment notebooks and CSVs (M4, ILI, traffic, GECCO anomaly, Bangladesh rainfall, Slovak WDN, `tsf_compare` original library) |
| `experiment-passed/` | Notebooks whose experiments worked |
| `experiment-failed/` | Notebooks whose experiments did not pan out |

Two notebooks in `experiment/demonstration_mid/` read `../../../backend/data/ili/national_illness.csv`
(created by the backend seed / Docker first start).
