# EarthSift — Technical Stack & Dependency Architecture

**Challenge:** NASA Space Apps 2026 — *Be An Earth System Trend Detective!*  
**Verified:** 2026-10-21  

---

## 1. Architecture Overview
EarthSift is structured as a decoupled scientific computing platform with a high-performance Python FastAPI backend service executing vectorized mathematical trend models, and a modern React 19 + Vite 8 single-page application (SPA) featuring off-thread Web Worker statistical acceleration and dual 2D/3D geospatial visualization.

```
                          ┌──────────────────────────────────────────────┐
                          │     Frontend Web Client (React 19 SPA)       │
                          │   Vite 8 • Tailwind v4 • Zustand 5 • Toast   │
                          │   Leaflet 1.9.4 Canvas • Chart.js 4.5.1      │
                          │   3D Orthographic Globe (PlanetaryGlobe3D)   │
                          └──────────────────────┬───────────────────────┘
                                                 │ Async REST / JSON
                                                 │ (Web Worker calcWorker offload)
                          ┌──────────────────────▼───────────────────────┐
                          │          FastAPI Web Service (ASGI)          │
                          │        Pydantic v2 • SlowAPI • Limits        │
                          │        HMAC-SHA256 SQLite WAL Cache          │
                          └──────────────┬───────────────────────────────┘
                                         │
                    ┌────────────────────┴────────────────────┐
                    ▼                                         ▼
     ┌──────────────────────────────┐          ┌──────────────────────────────┐
     │      Data Adapter Layer      │          │   Scientific Analysis Core   │
     │  - NASA POWER API (CERES/    │          │  - Vectorized Mann-Kendall   │
     │    MERRA-2 solar & thermal)  │          │  - Vectorized Theil-Sen      │
     │  - MERRA-2 Reanalysis        │          │  - Hamed & Rao (1998) Var*   │
     │  - earthaccess CMR Streaming │          │  - Benjamini-Hochberg (α=.05)│
     │  - Deterministic Fixtures    │          │  - Moran's I & Anselin LISA  │
     └──────────────────────────────┘          │  - Bivariate Copula Hazard   │
                                               │  - Climate Velocity Vectors  │
                                               └──────────────────────────────┘
```

---

## 2. Backend Technologies

| Component | Technology | Version | Purpose & Rationale |
|---|---|---|---|
| **Language** | Python | 3.12 / 3.13 | High-performance scientific computing runtime with robust C-extension support. |
| **API Framework** | FastAPI | >=0.110.0 (0.142.2) | High-throughput asynchronous ASGI REST framework with automatic OpenAPI schema generation. |
| **Validation** | Pydantic | >=2.6.0 (2.12.5) | Strict Pydantic v2 input boundary validation, NaN/Inf sanitization, and typed response schemas. |
| **ASGI Server** | Uvicorn | >=0.28.0 (0.42.0) | Production-grade ASGI web server with worker management. |
| **Array Math** | NumPy | >=1.26.0 (2.4.2) | Vectorized 3D array broadcasting (`np.triu_indices`, `np.nanmedian`) for zero-loop spatial trend computation. |
| **Statistics** | SciPy | >=1.12.0 (1.17.1) | Analytical normal distribution CDF, rank transformations (`scipy.stats.rankdata`), and 2D spatial convolution (`scipy.ndimage.convolve`). |
| **Multi-dim Data** | xarray | >=2024.1.0 | NetCDF/HDF5 labeled multi-dimensional dataset handling and geospatial subsetting. |
| **NetCDF IO** | netCDF4 & h5netcdf | >=1.6.5 / >=1.3.0 | Binary CF-1.8 compliant NetCDF file generation and NASA granule inspection. |
| **NASA CMR Access** | earthaccess | >=0.19.0 | Client library for NASA Common Metadata Repository (CMR) search and Earthdata streaming. |
| **Rate Limiting** | SlowAPI & Limits | >=0.1.9 / >=3.10.0 | IP-based request throttling with trusted proxy header parsing and RFC 6585 compliance. |
| **Configuration** | python-dotenv | >=1.0.1 | Type-safe environment variable resolution across development and production containers. |
| **System Metrics** | psutil | >=5.9.0 | Hardware resource monitoring (RAM, CPU, disk) for system readiness checks. |
| **Test Suite** | pytest | >=8.0.0 (9.0.3) | Complete test suite (138 tests) covering unit math, security hardening, cache concurrency, and API integrity. |
| **HTTP Client** | HTTPX | >=0.27.0 (0.28.1) | Synchronous and asynchronous ASGI test client for endpoint validation. |

---

## 3. Frontend Technologies

| Component | Technology | Version | Purpose & Rationale |
|---|---|---|---|
| **UI Framework** | React | 19.2.8 | Declarative component hierarchy utilizing modern React 19 primitives. |
| **Build Tooling** | Vite | 8.3.0 | Instantaneous Hot Module Replacement (HMR) and optimized Rollup production bundling. |
| **Styling** | Tailwind CSS v4 | 4.3.3 (`@tailwindcss/vite`) | CSS-first configuration with zero runtime overhead, supporting rich dark glassmorphism mission-control themes. |
| **State Management**| Zustand | 5.0.15 | Lightweight atomic state store managing active analysis results, coordinate inspection, and filter modes. |
| **2D Cartography** | Leaflet & React-Leaflet | 1.9.4 / 5.0.0 | High-performance raster and vector geospatial grid rendering with hardware-accelerated Canvas layer. |
| **3D Globe** | Custom Canvas Globe | `PlanetaryGlobe3D.jsx` | Interactive HTML5 Canvas 3D orthographic projection rendering global climate trends without WebGL baggage. |
| **Time-Series Charts**| Chart.js & React-Chartjs-2 | 4.5.1 / 5.3.1 | Responsive canvas-rendered time-series plots with fitted Sen's slope trendlines and changepoints. |
| **Motion & Micro-FX** | Framer Motion | 14.1.0 | Smooth card transitions, slide-over panels, and interactive modal dialogs. |
| **Routing** | React Router DOM | 7.18.4 | Client-side routing with deep-link support and full API 404 isolation. |
| **Notifications** | React Hot Toast | 2.6.1 | Non-intrusive tactile telemetry alerts for cache hits, data queries, and exports. |
| **Web Worker** | Web Worker API | Native ES6 | `calcWorker.js` background statistical calculation offloading, maintaining 60 FPS UI responsiveness. |
| **Sonification** | Web Audio API | Native Browser Audio | Pitch-mapped sonification of warming rates and tactile audio feedback (`audio.js`, `sonification.js`). |
| **Linter** | Oxlint | 1.81.0 | Ultra-fast Rust-based static code analysis ensuring zero syntax, import, or accessibility defects. |

---

## 4. Key Architectural Decisions

1. **React 19 + Vite 8 Production SPA:** Replaced legacy vanilla prototypes with a modern, reactive component hierarchy styled via Tailwind CSS v4 and managed by Zustand 5. Heavy analytical transforms are offloaded to `calcWorker.js` to ensure the main UI thread never stutters.
2. **In-House Vectorized NumPy/SciPy Statistical Engine:** Avoids black-box dependencies (`pymannkendall`, `xclim`) in favor of our own rigorously tested 3D vectorized engine (`trend.py`) supporting Hamed & Rao (1998) serial autocorrelation corrections, Gilbert (1987) non-parametric confidence bounds, and Benjamini-Hochberg FDR control at $\alpha = 0.05$.
3. **Dual 2D/3D Geospatial Visualization:** Combines Leaflet 1.9.4 Canvas rendering for micro-scale grid cell inspection with a custom HTML5 Canvas 3D orthographic globe (`PlanetaryGlobe3D.jsx`) for macro-scale hemispheric overview, requiring zero WebGL runtime complexity or external map vendor tokens.
4. **Cryptographic HMAC-SHA256 SQLite Cache:** Persists analysis metadata and compressed payloads in a high-concurrency SQLite WAL database with thread-local connections and cryptographic HMAC signing to eliminate deserialization exploits and redundant NASA API queries.
5. **Deterministic Fallback Explainer with AI Transparency:** When an OpenAI/Anthropic API key is absent, the system deterministically constructs peer-review-grade natural language evidence summaries directly from the verified mathematical record, guaranteeing zero numerical hallucinations.
