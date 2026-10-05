# EarthSift — Open-Source Research & Technology Evaluation

_Last verified: 2026-10-05_

## 1. Challenge Source-of-Truth

Verified on 2026-10-05 against:  
**URL:** https://www.spaceappschallenge.org/2026/challenges/be-an-earth-system-trend-detective/

| Field | Value |
| :--- | :--- |
| Title | Be An Earth System Trend Detective! |
| Event | 2026 NASA Space Apps Challenge |
| Difficulty | Advanced |
| Categories | Earth Science, Software |
| Resources tab | Empty (not populated as of 2026-10-05) |

**Exact challenge excerpt (from live page JSON payload):**

> Change is always occurring in the Earth's interconnected environmental system, and when it runs in a consistent direction – rising or falling, increasing or decreasing, thickening or thinning – measured variables reflect it. But a variable can trend one way in one region and the opposite way in another, even when the same process drives both. Your challenge is to find and examine variables measured by NASA missions or produced by NASA models, visualize how they change over time, and determine what is changing, where it is changing, how much it is changing, and if these changes are what scientists call "significant."

---

## 2. Verified NASA Datasets (via NASA CMR API, 2026-10-05)

All queries ran against: `https://cmr.earthdata.nasa.gov/search/collections.json`

| Dataset | Short Name | Version | Archive Center | CMR Verified |
| :--- | :--- | :--- | :--- | :---: |
| MERRA-2 Monthly Land Variables | `M2TMNXLND` | 5.12.4 | NASA/GSFC/SED/ESD/TISL/GESDISC | ✅ |
| MERRA-2 Monthly Atmosphere | `M2TMNXSLV` | 5.12.4 | NASA/GSFC/SED/ESD/TISL/GESDISC | ✅ |
| MODIS LST 8-Day L3 1km | `MOD11A2` | 061 | LP DAAC | ✅ |

**Access method:** `earthaccess` v0.19.0 — Client library for NASA Earthdata APIs (PyPI verified).  
Authentication: NASA Earthdata login (`.netrc` or `earthaccess.login(strategy="netrc")`).

---

## 3. Python Package Inventory (PyPI-verified, 2026-10-05)

| Domain | Library | PyPI Name | Version | License | Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **NASA Data Ingestion** | [`earthaccess`](https://github.com/earthaccess-dev/earthaccess) | `earthaccess` | 0.19.0 | MIT (upstream; license field blank on PyPI) | NASA Earthdata search + OPeNDAP streaming |
| **Multi-dim Data Model** | [`xarray`](https://github.com/pydata/xarray) | `xarray` | Latest | Apache 2.0 | NetCDF/Zarr labeled array model |
| **Numerical Core** | NumPy + SciPy | `numpy`, `scipy` | Latest | BSD 3-Clause | Array math, Mann-Kendall broadcasting, BH-FDR |
| **Statistical Tests** | [`pyMannKendall`](https://github.com/mmhs013/pyMannKendall) | `pymannkendall` | 1.4.3 | MIT | Reference implementation of MK + seasonal MK tests |
| **Spatial Masking** | [`regionmask`](https://github.com/regionmask/regionmask) | `regionmask` | 0.13.0 | MIT | Create region masks for grids |
| **Backend API** | [`FastAPI`](https://github.com/fastapi/fastapi) | `fastapi` | 0.142.2 | MIT | Typed async REST API |
| **Data Validation** | Pydantic | `pydantic` | Latest | MIT | Request/response schema validation |
| **Map Rendering** | [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) | (CDN) | Latest | BSD 3-Clause | WebGL choropleth + raster map |
| **Time Series Charts** | [Apache ECharts](https://github.com/apache/echarts) | (CDN) | Latest | Apache 2.0 | Time series + anomaly visualization |

---

## 4. Scientific Methodology Summary

### Trend Detection Algorithm (implemented in `backend/app/science/trend.py`)

**Step 1 — Non-parametric Mann-Kendall Test**
- Null hypothesis H₀: no monotonic trend present
- Test statistic S computed from all pairwise comparisons: `S = Σ sign(xⱼ - xᵢ) for j > i`
- Variance accounts for ties (Gilbert 1987)
- Two-sided p-value computed

**Step 2 — Sen's Slope Estimator**
- Non-parametric slope: median of all pairwise slopes: `β = median((xⱼ - xᵢ)/(j - i) for j > i)`
- Normalized to decadal rate for reporting

**Step 3 — Benjamini-Hochberg FDR Correction**
- Applied when grid-cell count > 1
- Controls false discovery rate at q = 0.10 across all simultaneous tests
- Prevents "p-hacking by spatial sampling"

### Why Non-Parametric?

Environmental time series frequently exhibit:
- Non-normality (precipitation, fire events)
- Seasonal cycles and autocorrelation
- Outliers from extreme weather events

OLS regression assumptions (normality, homoscedasticity) are routinely violated. Mann-Kendall + Sen's Slope is the accepted standard in climate science literature (e.g., Hirsch et al., 1982; IPCC AR6 Chapter 11).

---

## 5. Repositories Inspected (2026-10-05)

| Repository | URL | Confirmed Exists |
| :--- | :--- | :---: |
| earthaccess | https://github.com/earthaccess-dev/earthaccess | ✅ |
| pyMannKendall | https://github.com/mmhs013/pyMannKendall | ✅ |
| regionmask | https://github.com/regionmask/regionmask | ✅ |
| maplibre-gl-js | https://github.com/maplibre/maplibre-gl-js | ✅ (public, verified via PyPI home_page) |

---

## 6. Dependency Minimization Policy

1. **No Dask by default** — MERRA-2 monthly data at demo resolution fits in memory; Dask added only if data > 4 GB.
2. **No xclim** — xclim wraps Mann-Kendall but adds 50+ dependencies. We use `pymannkendall` directly, which is a clean single-purpose package.
3. **No statsmodels** — Avoided for OLS trend; only non-parametric methods used. statsmodels kept as optional if ARIMA noise modeling is later required.
4. **No Dask, PySAL, GeoPandas at MVP** — added only if proven necessary during Phase 4 data integration.
