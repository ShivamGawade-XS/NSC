# EarthSift — Product Requirements Document (PRD)

**Challenge:** NASA Space Apps 2026 — *Be An Earth System Trend Detective!*  
**Tagline:** *Find the changes worth investigating.*  
**Author:** EarthSift Core Engineering Team  
**Status:** Implemented & Verified (Release Gate Complete)

---

## 1. Problem Statement
Earth system observations spanning decades are replete with complex, non-linear signals. Scientists and climate analysts face two critical failure modes when examining satellite and reanalysis data:
1. **False Positives from Multiple Testing:** Testing thousands of spatial grid cells simultaneously without multiplicity control leads to false discoveries.
2. **Serial Autocorrelation Distortion:** Classical monotonic trend tests (e.g., standard Mann-Kendall) inflate significance when serial persistence (red noise) is present.
3. **AI Hallucinations:** Generative AI systems frequently hallucinate trend rates, fabricate statistical p-values, or infer unverified causal mechanisms.

EarthSift solves this by enforcing an **evidence-first, inspectable workflow** where all statistical rates, significance levels, and spatial contrasts are calculated mathematically before reaching any user interface or downstream explainer.

---

## 2. Core Value Proposition
- **Mathematically Grounded:** Non-parametric Mann-Kendall test with Hamed & Rao (1998) autocorrelation correction, Sen's robust slope estimator, and Benjamini-Hochberg False Discovery Rate (FDR) control.
- **Transparent Discovery Engine:** "Find Something Interesting" ranks candidate signals using an explicit composite score balancing slope magnitude, significance, coverage, and spatial coherence.
- **Regional Divergence (Contrast Engine):** "Find Contrasts" surfaces opposing validated trends within the same temporal window without implying speculative causation.
- **Zero-Hallucination Explainer:** Downstream AI explainer accepts only structured, validated evidence records and is paired with deterministic offline fallback text.
- **Explicit Data Regime Labeling:** Guaranteed unmistakable labeling of synthetic test fixtures versus live NASA Earthdata streams.

---

## 3. User Personas
- **Climate & Earth System Researcher:** Needs mathematically rigorous trend slopes with FDR multiplicity control and provenance citations.
- **Science Educator / Communicator:** Needs clear, interactive spatial maps and intuitive time series drilldowns to explain regional climatic changes.
- **Hackathon Judge / General Public:** Demands an accessible, fast, and transparent scientific instrument that runs without network fragility or hallucinated data.

---

## 4. Key Functional Requirements

| Feature | Requirement | Implementation Status |
|---|---|---|
| **Data Ingestion** | Abstract `DatasetAdapter` with `discover()`, `metadata()`, `validate()`, `fetch()`, `subset()`, `normalize()` | **PASS** (`MERRA2Adapter` with `earthaccess` integration) |
| **Trend Computation** | Vectorized Mann-Kendall, Sen's Slope, Hamed-Rao correction, BH-FDR | **PASS** (`backend/app/science/trend.py`) |
| **Multiplicity Control** | Expose both raw p-values and adjusted FDR q-values (q ≤ 0.05) | **PASS** (Both displayed in UI and returned via API) |
| **Discovery Engine** | Surface candidate signals via composite formula: \|slope\| × sig × comp × (1 + coh) | **PASS** (`GET /analysis/{id}/signals` + UI button) |
| **Contrast Engine** | Pair opposing spatial trends (e.g. warming vs cooling, wetting vs drying) | **PASS** (`GET /analysis/{id}/contrasts` + UI focus) |
| **Evidence Panel** | Structured record: observation, magnitude, significance, coverage, method, limitation, source | **PASS** (`GET /analysis/{id}/timeseries` evidence object) |
| **Downstream AI** | Explainer downstream of math engine; deterministic fallback if offline | **PASS** (`POST /explain`) |
| **Demo Mode** | Unmistakable labeling: *"Synthetic test data — not NASA observations."* | **PASS** (Prominent banner + provenance tag) |

---

## 5. Non-Functional Requirements
- **Latency:** Spatial trend calculation across regional domains completed in < 1.0 second.
- **Resilience:** Full offline operation without mandatory external credentials or active NASA network connection.
- **Security:** Strict request validation, CORS protection, zero credential exposure in client bundle.
- **Accessibility & Design:** Modern, restrained dark-theme scientific instrument layout (LEFT: controls, CENTER: map, BOTTOM: time series, RIGHT: evidence).
