# EarthSift — Open-Source Research & Technology Evaluation

_Last verified: 2026-10-21_

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

## 2. Verified NASA Datasets & Access Endpoints

All queries ran against NASA CMR Search (`https://cmr.earthdata.nasa.gov/search/collections.json`) and NASA POWER API (`https://power.larc.nasa.gov`):

| Dataset | Short Name / Source | Version / Endpoint | Archive Center | Verified |
| :--- | :--- | :--- | :--- | :---: |
| MERRA-2 Monthly Land Variables | `M2TMNXLND` | 5.12.4 | NASA GES DISC | ✅ |
| MERRA-2 Monthly Atmosphere | `M2TMNXSLV` | 5.12.4 | NASA GES DISC | ✅ |
| MODIS LST 8-Day L3 1km | `MOD11A2` | 061 | LP DAAC | ✅ |
| NASA POWER Monthly Climatology | Solar & Thermal Indices | `api/temporal/monthly/regional` | NASA LaRC POWER Project | ✅ |

**Access methods:**
1. `earthaccess` v0.19.0 — Python client library for NASA Earthdata CMR searches and OPeNDAP streaming.
2. Direct REST integration with NASA POWER API for fast regional spatial bounding boxes.
3. Authenticated `.netrc` credential manager for Earthdata login with strict newline-injection protection.

---

## 3. Technology & Dependency Inventory

| Domain | Library / Tool | PyPI / npm Package | Version | License | Architectural Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **NASA Data Ingestion** | [`earthaccess`](https://github.com/earthaccess-dev/earthaccess) | `earthaccess` | >=0.19.0 | MIT | NASA Earthdata search and OPeNDAP granule access. |
| **Multi-dim Data Model**| [`xarray`](https://github.com/pydata/xarray) | `xarray` | >=2024.1.0 | Apache 2.0 | NetCDF/HDF5 labeled multi-dimensional dataset handling. |
| **Numerical Core** | NumPy + SciPy | `numpy`, `scipy` | >=1.26.0 / >=1.12.0 | BSD 3-Clause | 3D array broadcasting, Mann-Kendall $S$, rank transforms, 2D convolution. |
| **Statistical Trend Core**| **In-House Vectorized Engine** | `backend/app/science/trend.py` | Native | Proprietary/MIT | Vectorized Theil-Sen, Mann-Kendall with Hamed-Rao (1998) autocorrelation correction, Pettitt changepoints. *(Evaluated `pymannkendall` as reference benchmark).* |
| **Spatial Autocorrelation**| **In-House Spatial Engine** | `backend/app/science/spatial.py` | Native | Proprietary/MIT | Global Moran's I (Cliff & Ord 1981) and Anselin (1995) Local Moran's I (LISA) clustering. |
| **Backend REST API** | [`FastAPI`](https://github.com/fastapi/fastapi) | `fastapi` | >=0.110.0 | MIT | Asynchronous ASGI REST web service with OpenAPI documentation. |
| **Data Validation** | Pydantic v2 | `pydantic` | >=2.6.0 | MIT | Strict coordinate boundary validation and response serialization. |
| **Rate Limiting** | SlowAPI & Limits | `slowapi`, `limits` | >=0.1.9 / >=3.10.0 | MIT | Proxy-aware IP rate limiting with trusted upstream resolution. |
| **UI Framework** | React 19 | `react`, `react-dom` | 19.2.8 | MIT | Modern declarative reactive user interface. |
| **Build System** | Vite 8 | `vite`, `@vitejs/plugin-react` | 8.3.0 | MIT | Next-generation frontend build tooling and rapid development server. |
| **CSS Architecture** | Tailwind CSS v4 | `tailwindcss`, `@tailwindcss/vite` | 4.3.3 | MIT | CSS-first utility engine with zero runtime overhead for mission-control dark UI. |
| **State Management**| Zustand 5 | `zustand` | 5.0.15 | MIT | Atomic reactive store for active dataset state and coordinate inspection. |
| **2D Cartography** | Leaflet | `leaflet`, `react-leaflet` | 1.9.4 / 5.0.0 | BSD 2-Clause | High-performance 2D spatial grid rendering via hardware-accelerated Canvas layer. |
| **3D Planetary Globe** | Custom Canvas Globe | `PlanetaryGlobe3D.jsx` | Native | Proprietary/MIT | Interactive HTML5 Canvas 3D orthographic globe projection without WebGL baggage. |
| **Time-Series Charts**| Chart.js | `chart.js`, `react-chartjs-2` | 4.5.1 / 5.3.1 | MIT | Responsive canvas-rendered time-series plots with fitted Sen's slope trendlines and changepoints. |
| **Web Worker Engine** | Web Worker API | Native ES6 | Browser Native | — | Client-side background statistical calculation offloading (`calcWorker.js`). |

---

## 4. Scientific Methodology Summary

### Trend Detection Algorithm (`backend/app/science/trend.py`)

**Step 1 — Non-Parametric Mann-Kendall Test with Hamed-Rao Variance Correction**
- Null hypothesis $H_0$: No monotonic trend present in the environmental time series.
- Test statistic $S$ computed across all pairwise comparisons:
  $$S = \sum_{i < j} \text{sgn}(x_j - x_i)$$
- Base variance accounts for tied observations (Gilbert 1987).
- Serial autocorrelation is addressed via **Hamed & Rao (1998)** variance correction: The time series is detrended by the Theil-Sen slope, residuals are mapped to ranks, and empirical rank autocorrelations are evaluated with a conservative floor ($\text{Var}^*(S) \ge \text{Var}(S)$).
- Two-sided $p$-value computed from asymptotic standard normal distribution.

**Step 2 — Theil-Sen Slope Estimator & Gilbert Confidence Intervals**
- Non-parametric median of all pairwise temporal slopes:
  $$\beta = \text{median}\left(\frac{x_j - x_i}{j - i}\right), \quad \forall j > i$$
- Gilbert (1987) non-parametric 95% confidence intervals ($\alpha = 0.05$) computed directly from sorted slope distributions.
- Normalized to decadal rates for intuitive scientific comparison.

**Step 3 — Benjamini-Hochberg (BH) False Discovery Rate Control**
- Applied across all grid cells when spatial grid count $> 1$.
- Controls the expected false discovery proportion at target significance level $\alpha = 0.05$ (Pydantic-validated).
- Prevents spatial multiplicity inflation and accidental false-positive discoveries.

**Step 4 — Spatial Autocorrelation & Anselin LISA Clustering**
- Evaluates spatial autocorrelation with **Global Moran's I** using Cliff & Ord (1981) analytical variance.
- Classifies geographic patterns into High-High (Hotspots), Low-Low (Refugia), High-Low, and Low-High spatial anomalies via **Anselin Local Indicators of Spatial Association (LISA)** with analytical randomization tests.

---

## 5. Repositories Inspected & Benchmarked

| Repository | URL | Status & Architectural Role |
| :--- | :--- | :--- |
| earthaccess | https://github.com/earthaccess-dev/earthaccess | ✅ Integrated for NASA Earthdata login and CMR granule queries. |
| pyMannKendall | https://github.com/mmhs013/pyMannKendall | ✅ Inspected and benchmarked; superseded in production by in-house vectorized 3D NumPy engine. |
| leaflet | https://github.com/Leaflet/Leaflet | ✅ Integrated with Canvas renderer for high-density spatial grids. |
| Chart.js | https://github.com/chartjs/Chart.js | ✅ Integrated for lightweight, interactive canvas time-series charting. |

---

## 6. Dependency Minimization Policy

1. **No Dask by default** — Monthly reanalysis and satellite grids fit cleanly in container memory; avoids distributed scheduler overhead.
2. **No `pymannkendall` or `xclim` in production runtime** — `pymannkendall` was evaluated as a reference benchmark, but eliminated from production dependencies in favor of our own vectorized NumPy/SciPy engine (`trend.py`). This eliminates external black-box wrappers, enables full 3D temporal-axis vectorization, and incorporates Hamed & Rao (1998) autocorrelation corrections and Gilbert (1987) confidence intervals with zero external overhead.
3. **No Heavy WebGL Cartography (MapLibre / Cesium)** — Leaflet 1.9.4 with a custom HTML5 Canvas renderer, paired with our custom 3D orthographic Canvas globe (`PlanetaryGlobe3D.jsx`), delivers 60 FPS performance without requiring WebGL 2.0 or map tile subscription tokens.
4. **No statsmodels / OLS at Core** — Climate time series routinely violate OLS assumptions due to non-normality, heteroscedasticity, and extreme climate events; non-parametric rank-based estimators are enforced throughout.
