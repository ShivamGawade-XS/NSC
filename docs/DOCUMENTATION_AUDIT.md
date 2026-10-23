# EarthSift — Documentation ↔ Code Audit Matrix

**Challenge:** NASA Space Apps 2026 — *Be An Earth System Trend Detective!*  
**Document:** `docs/DOCUMENTATION_AUDIT.md`  
**Audit Date:** 2026-10-21 (Post-Hardening & Architectural Reconciliation Audit)  

---

## 1. Documentation Verification Table

Every document in the EarthSift repository has been systematically audited and cross-referenced against the actual production source code, package manifests, and automated test executions.

| Document | Exists | Matches Code | Evidence Checked | Verified Status | Refactored Scope |
|---|---|---|---|---|---|
| `README.md` | Yes | Yes | `backend/app/main.py`, `backend/requirements.txt`, `frontend-react/` | **PASS** | Complete workspace overview |
| `docs/PRD.md` | Yes | Yes | `backend/app/`, `frontend-react/`, `backend/tests/` | **PASS** | Scientific mandate & evidence specs |
| `docs/TECH_STACK.md` | Yes | Yes | `frontend-react/package.json`, `backend/requirements.txt` | **PASS** | Lines 1–90 (React 19, Vite 8, Tailwind v4, Zustand 5, Leaflet Canvas, 3D Globe, Chart.js 4.5, NumPy 2 / SciPy 1.17) |
| `docs/ARCHITECTURE.md` | Yes | Yes | `frontend-react/src/`, `backend/app/science/`, `backend/app/core/` | **PASS** | Lines 1–149 (Pipeline, Leaflet Canvas, 3D Globe, Chart.js, calcWorker Web Worker, FDR $\alpha=0.05$, HMAC Cache) |
| `docs/DECISIONS.md` | Yes | Yes | `backend/app/science/trend.py`, `frontend-react/src/components/` | **PASS** | Lines 1–13 (ADR-001 through ADR-008: Leaflet Canvas, Chart.js 4.5, React 19 SPA, Vectorized NumPy/SciPy) |
| `docs/OPEN_SOURCE_RESEARCH.md`| Yes | Yes | `backend/app/science/trend.py`, `frontend-react/package.json` | **PASS** | Lines 1–111 (Leaflet Canvas, Chart.js 4.5, In-House Vectorized Engine vs pymannkendall, FDR $\alpha=0.05$) |
| `docs/METHODOLOGY.md` | Yes | Yes | `backend/app/science/trend.py`, `spatial.py`, `copula_hazard.py` | **PASS** | Mann-Kendall, Hamed-Rao, Theil-Sen, Moran's I, Copula |
| `docs/DATA_SOURCES.md` | Yes | Yes | `backend/app/adapters/power.py`, `merra2.py`, CMR queries | **PASS** | NASA POWER & MERRA-2 API endpoints |
| `docs/SCIENTIFIC_ASSUMPTIONS.md`| Yes | Yes | `backend/app/science/trend.py`, `frontend-react/src/components/` | **PASS** | Non-parametric limits, synthetic data alerts |
| `docs/OPEN_SOURCE_REUSE.md` | Yes | Yes | `backend/requirements.txt`, `frontend-react/package.json` | **PASS** | Open-source attribution ledger |
| `docs/LICENSE_LEDGER.md` | Yes | Yes | PyPI & npm dependency license compliance | **PASS** | Permissive MIT / BSD / Apache 2.0 validation |
| `docs/TEST_PLAN.md` | Yes | Yes | 138 test cases across `backend/tests/` (100% passing) | **PASS** | Unit, scientific math, and security suites |
| `docs/SCIENTIFIC_QA.md` | Yes | Yes | Benchmark baselines in `test_trend.py`, `test_spatial_and_copula_rigor.py` | **PASS** | $S$, $\tau$, Theil-Sen, Hamed-Rao, FDR $\alpha=0.05$ |
| `docs/SECURITY.md` | Yes | Yes | `test_security_hardening.py`, `backend/app/main.py`, `db_cache.py` | **PASS** | HMAC-SHA256 cache, CSP, rate limits, 413 DoS |
| `docs/AI_USAGE.md` | Yes | Yes | `backend/app/api/endpoints.py:explain_evidence` | **PASS** | Downstream explainer conditioned on evidence |
| `docs/DESIGN_SYSTEM.md` | Yes | Yes | `frontend-react/src/index.css`, Tailwind v4 tokens | **PASS** | High-contrast dark mission-control palette |
| `docs/DEMO_SCRIPT.md` | Yes | Yes | Walk-through script validated against live SPA | **PASS** | Step-by-step judge demonstration flow |
| `docs/SUBMISSION_DRAFT.md` | Yes | Yes | Aligned with official 2026 Space Apps mandate | **PASS** | Final submission text and field descriptions |
| `docs/CHANGELOG.md` | Yes | Yes | Git history milestones and commits (`git log`) | **PASS** | Chronological ledger of engineering phases |
| `docs/RELEASE_READINESS.md` | Yes | Yes | All production checklist gates confirmed passing | **PASS** | Docker build, test coverage, and security checks |
| `docs/OPEN_QUESTIONS.md` | Yes | Yes | Resolved assumptions and truth ledger items | **PASS** | Scientific questions tracked and closed |

---

## 2. Evidence Traceability Highlights & Exact Code Anchors

1. **Vectorized In-House Trend & Slope Engine:**
   - Vectorized upper-triangular array broadcasting for Theil-Sen: [`backend/app/science/trend.py:81-125`](file:///backend/app/science/trend.py#L81-L125).
   - Mann-Kendall $S$ statistic, tie-corrected base variance, and Kendall's $\tau$: [`backend/app/science/trend.py:128-215`](file:///backend/app/science/trend.py#L128-L215).
   - Gilbert (1987) non-parametric 95% confidence intervals ($\alpha = 0.05$): [`backend/app/science/trend.py:262-289`](file:///backend/app/science/trend.py#L262-L289).

2. **Hamed & Rao (1998) Serial Autocorrelation Correction:**
   - Trend removal via Theil-Sen, rank conversion of residuals, lag-1 through lag-10 empirical autocorrelation filtering, and conservative variance clamping ($\text{Var}^*(S) \ge \text{Var}(S)$): [`backend/app/science/trend.py:14-80`](file:///backend/app/science/trend.py#L14-L80).

3. **Benjamini-Hochberg (BH) Multiple-Testing FDR Control:**
   - Monotonic $q$-value reconstruction controlling False Discovery Rate at target significance $\alpha = 0.05$: [`backend/app/science/trend.py:292-342`](file:///backend/app/science/trend.py#L292-L342).

4. **Spatial Autocorrelation & Anselin LISA Clustering:**
   - Global Moran's I with exact Cliff & Ord (1981) analytical variance and Rook/Queen convolution: [`backend/app/science/spatial.py:27-135`](file:///backend/app/science/spatial.py#L27-L135).
   - Anselin (1995) Local Moran's I (LISA) hotspot/refugium classification with analytical randomization test: [`backend/app/science/spatial.py:138-198`](file:///backend/app/science/spatial.py#L138-L198).

5. **Compound Hazard Copula & Climate Velocity:**
   - Bivariate Archimedean copula fitting (Gumbel/Clayton) for compounding climate hazards: [`backend/app/science/copula_hazard.py:13-74`](file:///backend/app/science/copula_hazard.py#L13-L74).
   - Climate velocity speed (km/decade) and trajectory bearings: [`backend/app/science/climate_velocity.py:15-100`](file:///backend/app/science/climate_velocity.py#L15-L100).

6. **Frontend Architecture & Geospatial Cartography:**
   - React 19.2 + Vite 8.3 + Tailwind CSS v4.3 + Zustand 5.0 dependencies: [`frontend-react/package.json:12-32`](file:///frontend-react/package.json#L12-L32).
   - 2D Leaflet 1.9.4 hardware-accelerated Canvas renderer: [`frontend-react/src/components/TrendMap.jsx`](file:///frontend-react/src/components/TrendMap.jsx).
   - Custom 3D HTML5 Canvas Orthographic Globe: [`frontend-react/src/components/PlanetaryGlobe3D.jsx`](file:///frontend-react/src/components/PlanetaryGlobe3D.jsx).
   - Chart.js 4.5 responsive time-series plotting with fitted Sen trendlines: [`frontend-react/src/components/TimeSeriesChart.jsx`](file:///frontend-react/src/components/TimeSeriesChart.jsx).
   - Off-thread statistical transformations via Web Worker: [`frontend-react/src/workers/calcWorker.js`](file:///frontend-react/src/workers/calcWorker.js).

7. **Security Hardening & Cryptographic Cache:**
   - HMAC-SHA256 binary blob signing eliminating insecure deserialization: [`backend/app/core/db_cache.py:190-264`](file:///backend/app/core/db_cache.py#L190-L264).
   - Concurrent read/write stress validation (80 concurrent operations, 16 workers, zero errors): [`backend/tests/test_db_cache.py:225-352`](file:///backend/tests/test_db_cache.py#L225-L352).
   - Request size limiting (2MB chunked DoS protection) & API 404 isolation: [`backend/app/main.py:148-188, 245-255`](file:///backend/app/main.py#L148-L188).
