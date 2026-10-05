# EarthSift — Technical MVP Specification

## 1. Functional Requirements

* **FR-01 Dataset & Variable Catalog:** Enumerate supported NASA datasets (e.g., MERRA-2 surface temperature, precipitation, soil moisture) with native units, temporal frequency, and provider metadata.
* **FR-02 Spatial & Temporal Selection:** Support user-defined bounding boxes (`[min_lon, min_lat, max_lon, max_lat]`) and historical date windows.
* **FR-03 Validation Engine:** Enforce strict validation rules (e.g., end date > start date, minimum 5 temporal observations, valid coordinate ranges).
* **FR-04 Trend & Significance Computation:** Compute Sen's slope and Mann-Kendall $p$-values across all grid points in the subset.
* **FR-05 Multiple-Testing Correction:** Compute Benjamini-Hochberg adjusted $q$-values and provide an interactive significance mask toggle.
* **FR-06 Interactive Map:** Render spatial trend magnitudes (diverging color ramp) with significant areas stippled or highlighted.
* **FR-07 Time Series Drilldown:** Clicking any spatial cell loads the full observation record, mean baseline, and fitted trend line.
* **FR-08 Scientific Evidence Panel:** Detail observation count, slope magnitude with units, $p$-value, $q$-value, method, and source citations.
* **FR-09 Contrasting Region Discovery:** Identify paired regions exhibiting opposing, statistically significant trends over the identical time frame.
* **FR-10 Deterministic AI Explainer:** Optional natural language synopsis explaining the evidence record without generating fictitious numbers.

---

## 2. API Contract Specification

### `GET /api/v1/datasets`
Returns catalog of available NASA datasets and supported variables.

### `POST /api/v1/analysis`
Request payload:
```json
{
  "dataset_id": "merra2_reanalysis",
  "variable_id": "T2M",
  "start_date": "2000-01-01",
  "end_date": "2023-12-31",
  "bbox": [-125.0, 24.0, -66.5, 49.5],
  "aggregation": "annual_mean",
  "alpha": 0.05
}
```

Response payload:
```json
{
  "analysis_id": "ana_merra2_t2m_2000_2023",
  "status": "completed",
  "grid_shape": [50, 118],
  "variables": {
    "name": "2-meter Air Temperature",
    "units": "K",
    "slope_units": "K/decade"
  },
  "summary": {
    "total_cells": 5900,
    "significant_cells_raw": 3210,
    "significant_cells_fdr": 2840,
    "mean_slope": 0.32
  },
  "geojson_url": "/api/v1/analysis/ana_merra2_t2m_2000_2023/map"
}
```

### `GET /api/v1/analysis/{id}/cell?lat={lat}&lon={lon}`
Returns time series observations, Sen's slope, Mann-Kendall statistics, and evidence record for the specified coordinate.
