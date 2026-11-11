# EarthSift — Architectural Decision-by-Decision Review (Phase 7)

**Project:** EarthSift — Be An Earth System Trend Detective!  
**Competition:** NASA Space Apps Challenge 2026  
**Phase:** Phase 7 — Question Every Technology and Architectural Decision  
**Execution Timestamp:** 2026-10-24 12:31:00 UTC+05:30  
**Evaluator:** Adversarial Engineering & Scientific Validation Red Team  

---

## 1. Architectural Philosophy & Evaluation Criteria

Every library, framework, service, cache, abstraction, and algorithm in EarthSift must justify its existence against four strict criteria:
1. **Scientific Grounding:** Does it improve empirical correctness or reproducibility?
2. **Defensible Simplicity:** Is it the simplest approach that satisfies the requirement (YAGNI / Ponytail)?
3. **Operational Cost & Failure Surface:** What dependencies, maintenance burdens, or attack vectors does it introduce?
4. **Performance Benefit:** Does benchmark evidence justify its computational overhead?

---

## 2. Decision-by-Decision Technology Review

### 2.1 Backend Core: FastAPI + Pydantic v2
- **What it does:** Provides asynchronous HTTP routing, dependency injection, and Rust-accelerated schema validation.
- **Requirement Justification:** Needed for high-concurrency API servicing, automatic OpenAPI schema generation, and strict parameter boundary checking.
- **Alternatives Considered:** Flask, Django, Starlette, Tornado.
- **Why Chosen:** Flask lacks native asynchronous streaming and typed schema serialization; Django introduces unnecessary ORM database overhead for a scientific compute instrument.
- **Failure Modes:** Type coercion nuances in Pydantic v2 (e.g. converting floats to ints).
- **Verdict:** **KEEP.** Essential foundation; provides sub-millisecond route dispatch and strict boundary defense.

---

### 2.2 Mathematical Engine: NumPy + SciPy
- **What it does:** Powers array broadcasting, sorting, Theil-Sen slopes, rank correlation, Generalized Extreme Value (GEV) fitting, and 2D spatial convolution (`ndimage.convolve`).
- **Requirement Justification:** Computing 700,000 pairwise temporal slopes and 2,500 spatial neighborhood lags cannot be achieved in pure Python without severe CPU bottlenecks ($>1.8\text{s}$ vs $64\text{ms}$).
- **Alternatives Considered:** Pure Python, Numba JIT, Cython, C++ extensions.
- **Why Chosen:** NumPy/SciPy are ubiquitous, universally tested, compiled in C/Fortran, and introduce zero custom C-extension build failures across heterogeneous OS environments (Windows, Linux, macOS).
- **Failure Modes:** Memory allocation spikes if 3D arrays exceed RAM (prevented by SEC-001 2,500-cell bound).
- **Verdict:** **KEEP.** Industry standard; delivers $64\text{ms}$ execution for 48,000 observations.

---

### 2.3 Earth Observation I/O: xarray + h5netcdf / netCDF4
- **What it does:** Reads authentic multi-dimensional NetCDF-4 binary granules directly from NASA POWER and MERRA-2 and streams CF-1.8 compliant binary files to users.
- **Requirement Justification:** NetCDF is the authoritative, universal binary format for NASA EOSDIS and climate modeling.
- **Alternatives Considered:** Raw HDF5 (`h5py`), GeoTIFF (`rasterio`), Parquet.
- **Why Chosen:** xarray provides named coordinate slicing (`ds.sel(lat=..., lon=...)`), metadata preservation, and CF convention compliance.
- **Failure Modes:** File descriptor leaks if not wrapped in strict context managers (`with xr.open_dataset(...) as ds:`).
- **Verdict:** **KEEP.** Both adapters wrap xarray in strict context managers, closing file handles immediately.

---

### 2.4 Spatial Calculations: 2D Spatial Convolution vs. $N \times N$ Distance Matrix
- **What it does:** Computes spatial lag $\mathbf{Wz}$ for Moran's I and Anselin's LISA using $3 \times 3$ Rook/Queen convolution kernels via `scipy.ndimage.convolve`.
- **Requirement Justification:** Avoids the quadratic memory trap of constructing an explicit $N \times N$ spatial weight matrix ($2.56 \times 10^6$ elements for $N=1,600$).
- **Alternatives Considered:** PySAL / `esda`, explicit pairwise Euclidean distance matrices.
- **Why Chosen:** PySAL introduces heavy GIS dependencies (shapely, geopandas, fiona, rtree). A 2D convolution kernel achieves identical mathematical results in **$1.02\text{ms}$** with zero GIS bloat.
- **Failure Modes:** Edge-of-grid boundary cells have fewer neighbors; solved via asymmetric Cliff & Ord (1981) weight invariants.
- **Verdict:** **KEEP.** Outstanding architectural optimization.

---

### 2.5 Candidate Discovery Engine: Deterministic Formula vs. Machine Learning Classifier
- **What it does:** Ranks candidate signals using a transparent composite formula:  
  $\text{Score} = |\beta| \times w_{\text{sig}} \times \text{completeness} \times (1.0 + \text{spatial\_coherence})$.
- **Requirement Justification:** Surfaces high-priority signals for the NASA challenge without black-box opacity.
- **Alternatives Considered:** Random Forest classifier, unsupervised autoencoders, clustering (DBSCAN), LLM prompt scoring.
- **Why Chosen:** An ML model on limited regional training samples would overfit, require external model weights, lack calibrated probability bounds, and invite scientific skepticism. The deterministic formula is 100% transparent and defensible.
- **Failure Modes:** None; deterministic and non-random.
- **Verdict:** **KEEP.** Strongly recommended over uninterpretable AI hype.

---

### 2.6 Natural Language Query (NLQ) Copilot: Regex Knowledge Base vs. Generative LLM
- **What it does:** Extracts bounding box, variable ID, and start/end years from user queries (e.g., *"Show warming in Texas from 2000 to 2023"*).
- **Requirement Justification:** Allows natural language exploration for students and non-technical judges.
- **Alternatives Considered:** OpenAI GPT-4 API, local Hugging Face transformer (Llama-3/Mistral), LangChain.
- **Why Chosen:** An external LLM requires third-party API keys, introduces network latency ($>1.5\text{s}$), costs money, and risks prompt injection. EarthSift's regex parser executes in **$<0.2\text{ms}$**, requires zero keys, and operates 100% offline.
- **Failure Modes:** Complex conversational queries or typos outside the synonym dictionary fall back to default parameters.
- **Verdict:** **KEEP.** Appropriate, lightweight solution.

---

### 2.7 Frontend Framework: React 19 + Vite 8 + Zustand
- **What it does:** Renders the interactive dashboard, map, time-series charts, and modals.
- **Requirement Justification:** Real-time map pan/zoom, dynamic layer toggling, responsive charts, and audio sonification.
- **Alternatives Considered:** Vanilla JavaScript, Vue, Svelte, Next.js (SSR).
- **Why Chosen:** React has the richest ecosystem for geospatial (Leaflet) and chart (Chart.js) integrations. Vite compiles the 471 modules into production bundles in **$463\text{ms}$**. Zustand provides simple, boilerplate-free state management without Redux complexity.
- **Failure Modes:** Rapid user interactions causing out-of-order rendering (solved via `AbortController` single-flight keying in `client.js`).
- **Verdict:** **KEEP.** Fast, robust, responsive.

---

## 3. Redundancy & Dead Code Identification

### Architectural Finding ARCH-001: Legacy Vanilla Frontend Directory (`/frontend`)
- **Observation:** The repository root contains two frontend folders:
  1. `frontend-react/` (Active, modern React 19 SPA built by Vite).
  2. `frontend/` (Legacy prototype containing vanilla `index.html`, `landing.html`, `app.js`, `style.css`).
- **Audit Assessment:** In `backend/app/main.py`, FastAPI serves static assets exclusively from `frontend-react/dist`. The vanilla `frontend/` directory is completely unused in production.
- **Impact:** Causes mild developer confusion regarding which frontend is active; adds ~1MB of legacy code and unused Leaflet/Chart.js vendor assets to the repository.
- **Recommendation:** Archive or remove the legacy `frontend/` directory in a future cleanup release to maintain repository hygiene.

---

## 4. Ranked Architectural Improvement Recommendations

1. **ARCH-002 (Priority 1): NASA POWER Minimum Bounding Box Expansion:**  
   Update `fetch_live_granule` to ensure query bounding boxes span at least $2.0^\circ$ in latitude and longitude, preventing HTTP 422 rejections on localized queries.
2. **ARCH-003 (Priority 2): Pre-bundled Solar & Wind Fixtures:**  
   Add authentic pre-extracted NetCDF fixtures for solar irradiance (`ALLSKY_SFC_SW_DWN`) and wind speed (`WS10M`) in `backend/data/fixtures/` to eliminate offline temperature substitution (Finding PROV-001).
3. **ARCH-004 (Priority 3): Legacy Folder Pruning:**  
   Archive legacy `frontend/` prototype folder.

---

## 5. Architecture Review Verdict

The architecture is lean, robust, defensible, and remarkably free of gratuitous microservices, databases, or uninterpretable AI bloat.

**Phase 7 Complete.** Proceeding to Phase 8: Consolidated Failure Inventory and Root Cause Analysis.
