# EarthSift — System Architecture & Design

## 1. Challenge Overview
* **Event:** NASA Space Apps Challenge 2026
* **Challenge:** *Be An Earth System Trend Detective!*
* **Official URL:** [NASA Space Apps Challenge 2026](https://www.spaceappschallenge.org/2026/challenges/be-an-earth-system-trend-detective/)
* **Core Mandate:**
  > *"Find and examine variables measured by NASA missions or produced by NASA models, visualize how they change over time, and determine what is changing, where it is changing, how much it is changing, and if these changes are what scientists call 'significant.'"*

---

## 2. Product Mission & Philosophy

EarthSift is an evidence-first Earth-system trend discovery platform.

> **"The scientific engine is the product. The map and globe are the instruments. AI is an interpreter, not the calculator."**

### Core Investigation Inquiries
For any analyzed variable, EarthSift deterministically answers:
1. **What variable** is being analyzed? (CERES radiation, MERRA-2 thermal/wind/precip, MODIS LST)
2. **Where** is it changing spatially? (2D interactive Leaflet Canvas grid and 3D orthographic globe)
3. **What direction** is the change moving (increasing, decreasing, changepoint shift)?
4. **How large** is the estimated trend (in physical units per decade with 95% CI)?
5. **Over what time horizon** was it measured?
6. **How much valid data** supports the analysis (sample completeness, coordinate clamping warnings)?
7. **Is the trend statistically significant** under robust tests (Mann-Kendall with Hamed-Rao autocorrelation correction and Benjamini-Hochberg FDR control at $\alpha = 0.05$)?
8. **What does the result NOT establish?** (Limitations, avoiding causal overclaiming)

---

## 3. End-to-End Processing Pipeline

```text
                  NASA Earthdata / POWER API
                             │
                             ▼
                      Dataset Adapter
              (NASA POWER / MERRA-2 / Fixture)
                             │
                             ▼
                   Metadata & Validation
                  (Pydantic v2 Boundaries)
                             │
                             ▼
                      Subset Selection
                   (Temporal & Bounding Box)
                             │
                             ▼
                   Preprocessing & Units
                   (Decadal Scaling / NaN)
                             │
                             ▼
               Vectorized Scientific Engine
               ┌─────────────┴─────────────┐
               ▼                           ▼
            Magnitude                 Significance
        (Theil-Sen Slope)       (Mann-Kendall + Hamed-Rao)
               │                           │
               └─────────────┬─────────────┘
                             ▼
                Multiple-Testing Correction
               (Benjamini-Hochberg α = 0.05)
                             │
                             ▼
               Spatial & Compound Analytics
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
    Spatial LISA      Compound Hazards    Climate Velocity
   (Global Moran's I   (Archimedean Copula  (Vector Field &
   & Anselin Clusters)  Bivariate Returns)   Trajectory Bearing)
         │                   │                   │
         └───────────────────┼───────────────────┘
                             ▼
                   Cryptographic Cache
              (HMAC-SHA256 SQLite WAL Index)
                             │
                             ▼
                   Evidence Transparency
                             │
               ┌─────────────┴─────────────┐
               ▼                           ▼
       React 19 SPA Client         Downstream Explainer
    • Leaflet Canvas Grid & AOI    • Strict Grounded Summary
    • 3D Canvas Globe Projection   • NASA Technical Memo (LaTeX)
    • Chart.js 4.5 Time Series     • Google Colab 1-Click Code
    • calcWorker Web Worker        • CF-1.8 NetCDF Export
    • Web Audio Sonification
```

---

## 4. Architectural Components

### 4.1 Data Ingestion & Adapter Layer (`/backend/app/adapters`)
* **`BaseAdapter` Interface:** Common abstract base class for dataset discovery, metadata inspection, spatial/temporal clamping, and data extraction.
* **`NASAPowerAdapter`:** Directly fetches live NASA POWER daily/monthly climatology (solar radiation, 2-meter air temperature, precipitation) with automatic bounding box clamping and provenance attribution.
* **`MERRA2Adapter`:** Ingests MERRA-2 atmospheric and land surface reanalysis granules via OPeNDAP and local HDF5/NetCDF caching.
* **`SyntheticBenchmarkAdapter`:** Generates reproducible, physics-grounded synthetic fixtures with known trend slopes, changepoints, and noise models when running offline.

### 4.2 Scientific Analysis Engine (`/backend/app/science`)
* **Vectorized Trend Estimation (`trend.py`):** Vectorized upper-triangular array broadcasting across 3D grids (`np.triu_indices`) calculates pairwise median slopes (Theil-Sen) and Gilbert (1987) non-parametric 95% confidence intervals with zero Python loops over spatial cells.
* **Autocorrelation-Corrected Significance Testing (`trend.py`):** Non-parametric Mann-Kendall test augmented with **Hamed & Rao (1998)** variance correction, detrending via Sen's slope and evaluating rank autocorrelation across empirical lags with a conservative variance floor.
* **Multiple-Testing Adjustment (`trend.py`):** Controls false discovery rate across thousands of simultaneous grid cells using the **Benjamini-Hochberg (FDR)** procedure at significance level $\alpha = 0.05$.
* **Changepoint Detection (`trend.py`):** Vectorized **Pettitt test** locates non-parametric abrupt shift years in climate trajectories.
* **Spatial Autocorrelation & LISA Clusters (`spatial.py`):**
  - **Global Moran's I:** Evaluates spatial clustering using exact Cliff & Ord (1981) analytical variance and Rook/Queen convolution kernels.
  - **Anselin Local Moran's I (LISA):** Classifies grid cells into High-High (Hotspots), Low-Low (Refugia), High-Low, and Low-High spatial anomalies with analytical randomization $p$-values.
* **Compound Hazard Copula Modeling (`copula_hazard.py`):** Fits bivariate Archimedean copulas (Gumbel upper tail and Clayton lower tail) to estimate joint return periods for compounding climate extremes (e.g., severe heat combined with precipitation deficit).
* **Climate Velocity Vector Fields (`climate_velocity.py`):** Computes isocline speeds (km/decade) and trajectory movement bearings toward cooler regimes based on local spatial and temporal gradients.
* **Contrasting Regions Finder (`contrasts.py`):** Identifies dual opposing trend dipole regimes within the same temporal window.
* **Scientific Artifact Export (`export.py`):** Generates CF-1.8 compliant NetCDF binaries, GeoJSON feature collections, peer-reviewed NASA Technical Memorandum LaTeX documents, and executable Google Colab Jupyter Notebooks.

### 4.3 Evidence Layer & Cache (`/backend/app/core`)
* **Cryptographic Cache (`db_cache.py`):** High-throughput SQLite WAL database caching analysis summaries and coordinate drilldown time-series. Every compressed binary payload is sealed with an **HMAC-SHA256 signature** to eliminate insecure deserialization vulnerabilities and race conditions across concurrent workers.
* **Pydantic Schema Validation (`schemas/`):** Strict Pydantic v2 schemas validating bounding boxes, coordinate ranges, significance alpha bounds, and sanitizing non-finite values (`NaN`, `Inf`).

### 4.4 Web Application (`/frontend-react`)
* **Application Framework:** **React 19 (`react` 19.2.8)** built with **Vite 8 (`vite` 8.3.0)** and styled using **Tailwind CSS v4 (`@tailwindcss/vite` 4.3.3)** for modern, glassmorphic dark mission-control aesthetics.
* **State Management:** **Zustand 5 (`zustand` 5.0.15)** managing active analysis datasets, inspected coordinates, compound hazard layers, and playback states.
* **Web Worker Engine:** Offloads heavy mathematical transformations and coordinate indexing to a dedicated client-side Web Worker (`frontend-react/src/workers/calcWorker.js`), ensuring zero dropped frames during navigation.
* **2D Geospatial Cartography:** **Leaflet 1.9.4** with a custom Canvas renderer layer rendering multi-thousand cell trend grids, significance masks, and vector arrows with interactive tooltip drilldowns.
* **3D Planetary Globe:** Custom HTML5 Canvas 3D orthographic globe (`PlanetaryGlobe3D.jsx`) with realistic atmospheric glow, interactive rotation, and coordinate-aligned hotspot projection.
* **Time-Series Charting:** **Chart.js 4.5.1** (`react-chartjs-2`) rendering interactive canvas-backed time-series plots with fitted Sen's slope trendlines, Gilbert 95% confidence bands, and Pettitt changepoint markers.
* **Acoustic Sonification:** Native browser **Web Audio API** (`audio.js`, `sonification.js`) pitch-mapping warming and cooling velocities into audible soundscapes with comprehensive node cleanup.
* **Evidence Panel:** Displays live computed domain metrics, confidence intervals, Moran's I spatial coherence, data completeness, DOI links, and provenance warnings.

### 4.5 Multi-LLM Scientific Explainer & NLQ Copilot (`/backend/app/science`)
* **Downstream Scientific Explainer (`explainer.py`):** Translates verified empirical calculations into peer-reviewed scientific English without hallucination. Enforces strict XML evidence boundaries (`<evidence_context>`), temperature 0.2, and numerical preservation checks.
* **Cascading Multi-Provider Architecture:**
  1. **Primary**: Google Gemini (`gemini-flash-lite-latest`, `gemini-flash-latest`, `gemini-2.5-flash`).
  2. **Secondary Fallback**: Groq Cloud ultra-fast LLaMA (`api.groq.com`) or xAI Grok (`api.x.ai`).
  3. **Tertiary Fallback**: OpenAI (`gpt-4o-mini`).
  4. **Quaternary Base**: Zero-hallucination deterministic scientific template engine.
* **Natural Language Query Copilot (`nlq_parser.py`):** Translates freeform research inquiries (e.g., *"Show warming in Tibetan Plateau between 2005 and 2022"*) into structured bounding boxes, variable IDs, and temporal horizons using regex caching coupled with LLM JSON schema extraction.
* **Resource Protection & Spend Caps (`auth.py`):** Implements `DailyLLMBudgetTracker` capping anonymous external LLM calls to 200/day, gracefully degrading to deterministic templates once exhausted to protect project compute budgets.

### 4.6 Privacy-Preserving Telemetry & Observability (`/backend/app/core`)
* **Self-Hosted Telemetry:** `POST /api/v1/telemetry` stores anonymized route views and query dataset frequencies in local SQLite B-trees.
* **Zero PII & GDPR/CCPA Compliance:** Unconditionally honors `Do Not Track` (`navigator.doNotTrack === '1'`) and user cookie consent preferences. Collects zero IP addresses, zero device fingerprints, and zero advertising trackers.
* **Prometheus Observability:** Exposes live system metrics at `/metrics` and `/metrics/prometheus` for server health, memory RSS, cache hit ratios, and computed trend telemetry.

### 4.7 Zero-Synthetic Guarantee (`/backend/app/adapters`)
* **Strict Real Data Mandate:** In production mode (`STRICT_ZERO_SYNTHETIC=true`), synthetic data generation is permanently prohibited. If a NetCDF granule is unavailable, the system raises an explicit HTTP 503 guidance error instead of fabricating numbers.
* **Live Streaming:** Streams authentic NASA POWER and MERRA-2 Earth observations covering global coordinates from 1980 to 2026.

### 4.8 Transactional Communications (`/backend/app/core/mailer.py`)
* **Python Standard Library Mailer:** Direct SMTP dispatch using Python stdlib `smtplib` and `email.message.EmailMessage` over SSL/TLS port 587.
* **Zero Message Loss Queue:** If offline or credentials pending, submissions are safely archived to a local JSON inbox queue (`backend/data/inbox/`) with unique UUID receipt identifiers.

---

## 5. UI Workspace Layout

```text
┌─────────────────┬───────────────────────────────────────────┬──────────────────────┐
│                 │                                           │                      │
│ ANALYSIS        │             GEO-SPATIAL WORKBENCH         │ EVIDENCE             │
│ CONTROLS        │                                           │ RECORD & SUMMARY     │
│                 │   - 2D Leaflet Canvas Grid / Vectors      │                      │
│ • Dataset (NASA)│   - 3D Orthographic Globe (PlanetaryGlobe)│ • Observation Count  │
│ • Variable      │   - Significance Stippling / LISA Mask    │ • Sen Slope & 95% CI │
│ • Time Horizon  │   - Compound Hazard Overlay               │ • P-value & FDR (α)  │
│ • Bounding Box  │   - Hotspot & Refugium Highlights         │ • Moran's I & LISA   │
│ • Run Analysis  │   - Keyboard-First Grid Navigation        │ • Provenance & DOI   │
│                 │                                           │ • Downstream Summary │
├─────────────────┴───────────────────────────────────────────┴──────────────────────┤
│                                TIME SERIES INSPECTOR                               │
│  - Historical Observations  - Sen Slope Trendline  - 95% CI  - Changepoints (Pettitt)│
│  - Interactive Coordinate Drilldown  - Pitch-Mapped Sonification Audio Graph       │
└────────────────────────────────────────────────────────────────────────────────────┘
```
