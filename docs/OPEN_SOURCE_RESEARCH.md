# EarthSift — Open-Source Research & Technology Evaluation

## 1. Overview
To ensure rapid hackathon execution and high scientific reliability, EarthSift utilizes verified, mature open-source libraries rather than reinventing scientific mathematics or geospatial tiling engines.

---

## 2. Technology Stack & Component Evaluation

| Domain | Library | Purpose | License | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Data Ingestion** | [`earthaccess`](https://github.com/earthaccess-dev/earthaccess) | NASA Earthdata search, authentication, streaming | Apache 2.0 | **Primary Ingestion Adapter** |
| **Data Model** | [`xarray`](https://github.com/pydata/xarray) | Multi-dimensional labeled arrays (NetCDF/Zarr) | Apache 2.0 | **Core Scientific Model** |
| **Numerical Core** | [`numpy`](https://github.com/numpy/numpy), [`scipy`](https://github.com/scipy/scipy) | Array math, Theil-Sen estimators, distributions | BSD 3-Clause | **Direct Use** |
| **Statistical Tests**| [`pyMannKendall`](https://github.com/mmhs013/pyMannKendall) | Non-parametric monotonic trend calculation | MIT | **Validated Core** |
| **Backend API** | [`FastAPI`](https://github.com/tiangolo/fastapi), [`Pydantic`](https://github.com/pydantic/pydantic) | Typed JSON API, high-performance async serving | MIT | **Core API** |
| **Map Rendering** | [`MapLibre GL JS`](https://github.com/maplibre/maplibre-gl-js) | Hardware-accelerated vector and raster mapping | BSD 3-Clause | **Core Frontend Map** |
| **Time Series Charts**| [`Apache ECharts`](https://github.com/apache/echarts) | Scientific time series and anomaly charts | Apache 2.0 | **Core Visualizations** |
| **Frontend UI** | [`Next.js`](https://nextjs.org), [`Tailwind CSS`](https://tailwindcss.com) | Responsive application shell and workspace | MIT | **Core Frontend** |

---

## 3. Dependency Minimization Principles

1. **Avoid Bloat:** Packages such as `Dask`, `PySAL`, and `xclim` are reserved for scaling needs only if justified by specific dataset requirements.
2. **Standard Interfaces:** All scientific outputs serialize to standard GeoJSON and typed Pydantic payloads for zero frontend coupling to raw scientific formats.
3. **Open-Source Compliance:** All third-party libraries have their licenses recorded and attributed in the project documentation.
