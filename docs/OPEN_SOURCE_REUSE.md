# EarthSift — Open-Source Reuse & Attribution

**Challenge:** NASA Space Apps 2026 — *Be An Earth System Trend Detective!*  
**Document:** `docs/OPEN_SOURCE_REUSE.md`  

---

## 1. Open-Source Philosophy
EarthSift leverages battle-tested, permissive open-source packages from the scientific Python and geospatial ecosystems. Rather than reinventing low-level protocol handlers or baseline numerical primitives, EarthSift utilizes standard libraries and focuses its innovations on:
1. Strict, inspectable evidence architecture.
2. Vectorized 3D multi-temporal Mann-Kendall and Hamed-Rao spatial pipelines.
3. Transparent composite discovery scoring.
4. Paired regional contrast detection.
5. Deterministic downstream AI interpretation.

---

## 2. Reused Libraries & Justifications

### Scientific & Data Computing
- **NumPy (BSD-3-Clause):** Fundamental N-dimensional array processing. Used for vectorized 3D matrix operations across time and space.
- **SciPy (BSD-3-Clause):** Provides normal distribution cumulative density functions (`scipy.stats.norm.cdf`) and rank sorting (`scipy.stats.rankdata`).
- **earthaccess (MIT):** NASA-supported library for simplified authentication, search, and download of NASA Earth science data from the CMR and NASA DAACs.

### Web Service & API Layer
- **FastAPI (MIT):** High-performance Python web framework utilizing modern Python type annotations and asynchronous request handling.
- **Pydantic (MIT):** Enforces strict schema contracts, preventing unvalidated inputs from entering the scientific engine.
- **Uvicorn (BSD-3-Clause):** Lightning-fast ASGI server for production deployment.

### Frontend Visualization
- **Leaflet.js (BSD-2-Clause):** Lightweight, accessible open-source JavaScript cartography library for rendering interactive geospatial data layers.
- **Chart.js (MIT):** Flexible canvas-based charting library for time series line plots and trendline fits.
- **CARTO Dark Matter (Creative Commons / Free Tier):** Neutral basemap designed specifically for thematic data cartography.

---

## 3. Custom Implementations Built in EarthSift
- **Vectorized Spatial Trend Engine:** Custom implementation in `backend/app/science/trend.py` combining Mann-Kendall, Sen's Slope, and Hamed-Rao autocorrelation correction.
- **Benjamini-Hochberg FDR:** Vectorized monotonic adjusted q-value implementation handling 2D spatial fields with arbitrary NaN masking.
- **Discovery Engine:** Transparent composite scoring formula balancing magnitude, statistical significance, coverage, and spatial coherence.
- **Contrast Engine:** Opposing spatial cluster pairing with divergence delta computation and causal caveat enforcement.
- **Dataset Adapter Abstraction:** Base contract with `discover()`, `metadata()`, `validate()`, `fetch()`, `subset()`, and `normalize()`.
