# EarthSift — NASA Earth System Data Sources

**Challenge:** NASA Space Apps 2026 — *Be An Earth System Trend Detective!*  
**Document:** `docs/DATA_SOURCES.md`  

---

## 1. Supported NASA Datasets

### A. NASA MERRA-2 Atmospheric Reanalysis
- **Dataset Full Name:** Modern-Era Retrospective analysis for Research and Applications, Version 2
- **Provider:** NASA Global Modeling and Assimilation Office (GMAO)
- **DOI:** [10.5067/A7F0JNNUTWOB](https://doi.org/10.5067/A7F0JNNUTWOB)
- **NASA CMR Short Names:**
  - `M2TMNXSLV` (2D Monthly Mean Atmospheric Diagnostics)
  - `M2TMNXFLX` (2D Monthly Mean Surface Flux Diagnostics)
  - `M2TMNXLND` (2D Monthly Mean Land Surface Diagnostics)
- **Temporal Bounds:** 1980 - Present (44+ consecutive annual records)
- **Spatial Resolution:** $0.5^\circ \text{ latitude} \times 0.625^\circ \text{ longitude}$ (Global)
- **Variables Supported:**
  1. `T2M`: 2-meter Air Temperature (Source: Kelvin; Display: °C; Slope: °C / decade)
  2. `PRECTOT`: Total Precipitation Rate (Source: $\text{kg m}^{-2} \text{s}^{-1}$; Display: mm/day; Slope: mm/day / decade)
- **Citation:**
  > Gelaro, R., et al., 2017: *The Modern-Era Retrospective Analysis for Research and Applications, Version 2 (MERRA-2)*. Journal of Climate, 30(14), 5419-5454. DOI: 10.1175/JCLI-D-16-0758.1.

---

## 2. Ingestion & Retrieval Pipeline

### Access Modalities:
1. **Live NASA Earthdata Streaming:**
   - Managed via the `earthaccess` Python library (version 0.19.0).
   - Authenticated using NASA Earthdata Login credentials supplied via `.netrc` or `EARTHDATA_USERNAME` / `EARTHDATA_PASSWORD` environment variables.
   - Searches granules via the NASA Common Metadata Repository (CMR) API: `https://cmr.earthdata.nasa.gov/search/granules.json`.

2. **Deterministic Offline Demo Mode:**
   - Bundled physical atmospheric model fixture mirroring North American climate dynamics:
     - High-latitude Arctic warming amplification
     - Subpolar North Atlantic warming hole / cooling anomaly
     - Southwest US aridification / drying trend
     - Midwest / Northeast US wetting trend
   - Explicitly flags all output:
     `is_synthetic: true`
     `data_source_label: "Synthetic test data — not NASA observations."`

---

## 3. Data Integrity & Validation Rules
- **Minimum Temporal Samples:** Requires at least 5 consecutive annual points for monotonic testing.
- **Geographic Bounds:** Validates that requested bounding boxes intersect the coverage domain (`[-170.0, 15.0, -50.0, 75.0]`).
- **Coordinate Sorting:** Always normalizes coordinates into strictly ascending order (South-to-North latitudes, West-to-East longitudes).
- **Physical Clamping:** Non-negative variables (e.g. precipitation rate) are clamped to strictly physical lower bounds ($\ge 0.1 \text{ mm/day}$).
