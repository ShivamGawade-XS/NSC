# EarthSift — Project Changelog

All notable changes to the EarthSift platform are documented in this file.
The project adheres to Semantic Versioning and rigorous engineering verification.

---

## [1.0.0] - 2026-10-05 — NASA Space Apps Release

### Added
- **Scientific Computing Engine (`trend.py`):**
  - Non-parametric Mann-Kendall monotonic trend test ($S$, $\text{Var}(S)$, $\tau$, $Z$, two-tailed $p$).
  - Hamed & Rao (1998) serial autocorrelation variance adjustment for persistent geophysical time series.
  - Sen’s slope (Theil-Sen robust estimator) calculating median pairwise slopes and intercepts.
  - Benjamini-Hochberg False Discovery Rate (FDR) multiplicity control generating monotonic adjusted $q$-values.
  - Vectorized 3D spatial field processing (`compute_spatial_trends`).
- **Dataset Adapter Layer (`base.py`, `merra2.py`):**
  - Abstract `BaseDatasetAdapter` enforcing `discover()`, `metadata()`, `validate()`, `fetch()`, `subset()`, `normalize()`.
  - Integration with `earthaccess` (v0.19.0) for live NASA Earthdata / CMR collection querying.
  - Deterministic, physically grounded atmospheric model demo fixture for offline resilience.
  - Unmistakable labeling of synthetic data versus live NASA observations.
- **Discovery Engine (`discovery.py`):**
  - "Find Something Interesting" feature with transparent composite scoring formula:
    $\text{score} = |\beta| \times w_{\text{sig}} \times \text{completeness} \times (1 + \text{coherence})$.
  - 8-neighbor spatial cluster coherence evaluation.
- **Contrast Engine (`contrasts.py`):**
  - Discovery of opposing regional trend pairs over identical temporal periods.
  - Built-in caveats against inferring unproven causal links.
- **FastAPI Typed API (`endpoints.py`):**
  - `GET /health` and `GET /api/v1/health`
  - `GET /datasets` and `GET /datasets/{id}`
  - `GET /variables`
  - `POST /analysis`
  - `GET /analysis/{id}`
  - `GET /analysis/{id}/map`
  - `GET /analysis/{id}/timeseries`
  - `GET /analysis/{id}/signals`
  - `GET /analysis/{id}/contrasts`
  - `GET /analysis/{id}/provenance`
  - `POST /explain`
- **Scientific Instrument UI (`frontend/`):**
  - 4-panel ergonomic layout (LEFT: controls, CENTER: map, BOTTOM: time series, RIGHT: evidence).
  - Unmistakable demo mode warning banner: *"Synthetic test data — not NASA observations."*
  - Interactive Leaflet cartography with FDR significance stippling.
  - Interactive Chart.js time series with Sen's slope trendlines.
  - Structured 7-field Evidence Inspector.
  - Downstream AI explainer with deterministic fallback.
- **Automated Test Suite (`backend/tests/`):**
  - 36 automated unit, scientific, adapter, and application resilience tests (100% passing).

---

## [0.2.0] - 2026-10-05 — Open-Source Research & Truth Ledger Audit
- Completed live CMR API query verification for `M2TMNXSLV`, `M2TMNXFLX`, and `M2TMNXLND`.
- Verified package versions and licenses via PyPI API.
- Established `docs/TRUTH_LEDGER.md` with 13 verified facts and 2 recorded assumptions.

---

## [0.1.0] - 2026-10-05 — Initial Architecture & Skeleton
- Initialized FastAPI backend and static frontend.
- Created `README.md`, `AGENT_STATE.md`, and initial documentation outlines.
