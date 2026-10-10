# 🌍 EarthSift

> **Find the changes worth investigating.**  
> An evidence-first Earth-system trend discovery platform built for the **NASA Space Apps Challenge 2026**.

[![NASA Space Apps Challenge 2026](https://img.shields.io/badge/NASA%20Space%20Apps-2026-0B3D91?style=for-the-badge&logo=nasa)](https://www.spaceappschallenge.org/2026/challenges/be-an-earth-system-trend-detective/)
[![Challenge](https://img.shields.io/badge/Challenge-Be%20An%20Earth%20System%20Trend%20Detective!-blue?style=for-the-badge)](https://www.spaceappschallenge.org/2026/challenges/be-an-earth-system-trend-detective/)
[![Tests: 40 Passing](https://img.shields.io/badge/Tests-40%20Passing%20(100%25)-success?style=for-the-badge)](docs/TEST_PLAN.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

---

## 🛰️ Challenge Mandate

In the **2026 NASA Space Apps Challenge — *Be An Earth System Trend Detective!***, teams are tasked with:
> *"Find and examine variables measured by NASA missions or produced by NASA models, visualize how they change over time, and determine what is changing, where it is changing, how much it is changing, and if these changes are what scientists call 'significant.'"*

---

## 💡 The EarthSift Thesis

Many applications approaching Earth observation data build a standard pipeline:
$$\text{NASA Data} \longrightarrow \text{Map} \longrightarrow \text{Chart} \longrightarrow \text{AI Chatbot}$$

**EarthSift takes a strictly scientific, evidence-first approach:**

```text
NASA Earth-System Data (MERRA-2 via earthaccess / Offline Fixture)
        │
        ▼
Data Validation & Bounding Box Checks (DatasetAdapter)
        │
        ▼
Non-Parametric Trend Estimation (Theil-Sen Robust Median Slope)
        │
        ▼
Monotonic Significance Testing (Mann-Kendall Test)
        │
        ▼
Serial Autocorrelation Correction (Hamed & Rao 1998 Modified Variance)
        │
        ▼
Multiplicity Control (Benjamini-Hochberg False Discovery Rate q ≤ 0.05)
        │
        ▼
Discovery Engine ("Find Something Interesting" Composite Scoring)
        │
        ▼
Contrast Engine ("Find Contrasts" Opposing Regional Divergence)
        │
        ▼
Structured Evidence & Provenance Ledger (7 Inspectable Attributes)
        │
        ▼
Interactive Scientific Instrument (4-Panel Ergonomic Workstation)
        │
        ▼
Downstream AI Explainer (Interpreting verified mathematical records only)
```

> **Core Axiom:** *The scientific engine is the product. The map is the instrument. AI is an interpreter, not the calculator.*

---

## 🌟 Key Features

1. **Robust Trend Magnitude (Sen's Slope):** Outlier-resistant median-of-slopes estimator providing physically grounded trend rates (e.g., $+0.45\ ^\circ\text{C} / \text{decade}$) rather than noisy linear regressions.
2. **Monotonic Significance (Mann-Kendall Test):** Non-parametric rank-based statistical testing tailored for skewed, non-Gaussian environmental records.
3. **Autocorrelation Correction (Hamed & Rao 1998):** Solves the classical climate false-positive trap by adjusting test variance against $AR(1)$ red noise persistence.
4. **Multiplicity Correction (False Discovery Rate):** Controls error rates across thousands of spatial grid cells using Benjamini-Hochberg (BH) adjustments ($q \le 0.05$), filtering out statistical flukes.
5. **Discovery Engine ("Find Something Interesting"):** Transparent composite scoring formula balancing slope magnitude, statistical significance, coverage, and spatial cluster coherence to surface candidate signals worth investigating.
6. **Opposing Regional Contrasts ("Find Contrasts"):** Automatically discovers and pairs geographical regions experiencing opposite trends for the same variable and time window (e.g., simultaneous continental warming vs subpolar cooling), with strict caveats against implying unproven common causes.
7. **Interactive Time-Series Drilldown:** Click any cell on the GPU-accelerated Leaflet map to view historical observations, Sen trendline fits, and Kendall's $\tau$.
8. **Inspectable Evidence Inspector:** Every displayed finding is backed by an immutable structured record detailing observation, magnitude, significance ($p$ and $q$), data coverage, scientific method, limitations, and source DOIs.
9. **Unmistakable Demo Mode Labeling:** Guaranteed honest labeling: *"Synthetic test data — not NASA observations"* during offline demonstration mode.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Data Ingestion** | NASA Earthdata / CMR API, `earthaccess` (v0.19.0), NASA NetCDF4 / `xarray` (v2026.9), MERRA-2 Reanalysis (`M2TMNXSLV`, `M2TMNXFLX`) |
| **Scientific Engine** | Python 3.13 / 3.14, `numpy`, `scipy` (Multithreaded Parallel Row Chunk Execution) |
| **AI Explanation** | Google Gemini API (gemini-2.5-flash) / OpenAI with Deterministic Scientific Fallback |
| **API & Backend** | FastAPI, Pydantic, Uvicorn (Bounded LRU Caching) |
| **Geospatial Mapping** | Leaflet.js v1.9.4 (Canvas Renderer, 100% Offline Vendored), CARTO Dark Matter Basemap |
| **Data Visualization** | Chart.js v4.4.1 (Dynamic Scaling, 100% Offline Vendored) |
| **Web Shell** | Semantic HTML5, Responsive CSS3 (Mission-Control Dark Instrument with 1024px+ Ergonomics) |
| **Deployment** | Docker, Docker Compose, Multi-stage Slim Container |
| **Testing** | pytest (40 automated unit, scientific, NetCDF, and application resilience tests) |

---

## 🚀 Quickstart & Running Locally

### Option A: One-Command Docker Deployment (Recommended)
```bash
docker compose up --build
```
Open your browser at **`http://localhost:8000`** to interact with the mission-control dashboard.

### Option B: Native Python Setup
```bash
# 1. Install dependencies
pip install -r backend/requirements.txt
pip install netcdf4

# 2. Run the Scientific Server & Web Instrument
cd backend
uvicorn app.main:app --port 8000 --reload
```
Open **`http://localhost:8000`**.

### Option C: Run the Automated Test Suite
```bash
cd backend
pytest
```
All **40 / 40 tests** pass covering real NetCDF ingestion, multi-threaded parallel trend math, boundary conditions, adapter contracts, cache collision resilience, and connected component clustering.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health, version, and active statistical engine status |
| `GET` | `/datasets` | Catalog of available NASA datasets and supported variables |
| `GET` | `/datasets/{id}` | Metadata, resolution, temporal range, and citations for specific dataset |
| `GET` | `/variables` | Catalog of supported physical variables across datasets |
| `POST` | `/analysis` | Execute spatiotemporal trend analysis across domain |
| `GET` | `/analysis/{id}` | Retrieve full cached spatial analysis results |
| `GET` | `/analysis/{id}/map` | Geospatial grid stippling layer and bounding boundaries |
| `GET` | `/analysis/{id}/timeseries` | Coordinate time series observations, fitted line, and structured evidence |
| `GET` | `/analysis/{id}/signals` | Discovery Engine: top candidate signals ranked by transparent formula |
| `GET` | `/analysis/{id}/contrasts` | Contrast Engine: opposing regional trend pairs |
| `GET` | `/analysis/{id}/provenance` | Data lineage, source DOI citation, and synthetic/live status |
| `POST` | `/explain` | Downstream AI explainer translating verified evidence into plain English |

---

## 📚 Complete Documentation Suite

All 19 documentation assets are maintained and audited in the [`docs/`](docs/) directory:

* 📋 [**Product Requirements Document (PRD)**](docs/PRD.md): Functional and non-functional requirements matrix.
* 🛠️ [**Technical Stack**](docs/TECH_STACK.md): Full dependency specifications, versions, and justifications.
* 📐 [**System Architecture**](docs/ARCHITECTURE.md): Decoupled pipeline, state management, and data flow.
* 🔬 [**Scientific Methodology**](docs/METHODOLOGY.md): Mathematical formulations of Mann-Kendall, Hamed-Rao, Sen slope, and BH-FDR.
* 🛰️ [**Data Sources**](docs/DATA_SOURCES.md): MERRA-2 metadata, CMR short names, and Earthdata access modalities.
* 🧐 [**Scientific Assumptions**](docs/SCIENTIFIC_ASSUMPTIONS.md): Explicit assumptions, limitations, and anti-hallucination rules.
* 📦 [**Open-Source Reuse**](docs/OPEN_SOURCE_REUSE.md): Evaluated packages, library attribution, and custom code boundaries.
* ⚖️ [**License Ledger**](docs/LICENSE_LEDGER.md): Permissive license audit across all 13 dependencies.
* 🧪 [**Test Plan**](docs/TEST_PLAN.md): Complete testing matrix and execution guide (36 tests).
* 📊 [**Scientific QA**](docs/SCIENTIFIC_QA.md): Benchmark proofs comparing outputs to peer-reviewed literature.
* 🔒 [**Security Architecture**](docs/SECURITY.md): Threat vectors, least-privilege mitigations, and credential isolation.
* 🤖 [**AI Usage Policy**](docs/AI_USAGE.md): Strict downstream positioning and deterministic fallback engine.
* 🎨 [**Design System**](docs/DESIGN_SYSTEM.md): Human-designed scientific instrument tokens, palette, and typography.
* 🎬 [**Demo Script & 7-Slide Narrative**](docs/DEMO_SCRIPT.md): Step-by-step live demo walk-through and video narrative.
* 🏆 [**Submission Draft**](docs/SUBMISSION_DRAFT.md): Complete project summary tailored for NASA Space Apps judges.
* 📜 [**Changelog**](docs/CHANGELOG.md): Semantic version history and milestone tracking.
* ✅ [**Release Readiness**](docs/RELEASE_READINESS.md): Release gate checklist (19/19 criteria PASS).
* 🔍 [**Documentation Audit**](docs/DOCUMENTATION_AUDIT.md): Traceability matrix linking documentation claims to source code.
* ❓ [**Open Questions Ledger**](docs/OPEN_QUESTIONS.md): Bounded question tracking and resolutions.

---

## 🔬 Scientific Caveats & Honest Limitations

* **Trend $\neq$ Causation:** Trend detection quantifies empirical change over time but does not prove causal mechanisms.
* **Period Dependence:** Trends are bounded by the observed timeframe; short-term trends do not guarantee long-term trajectories.
* **Resolution Honesty:** Data are represented at native sensor/model resolution without misleading sub-grid interpolation.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
