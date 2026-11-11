# EarthSift 2.0 — Product Evolution Plan & Scientific Gap Analysis
## Core Excellence, Scientific Intelligence & Differentiated Product Evolution

**Project:** EarthSift — Autonomous Spatial Trend Discovery Instrument  
**Competition:** NASA Space Apps Challenge 2026 — *"Be An Earth System Trend Detective!"*  
**Document:** `NASA_CHALLENGE_PRODUCT_EVOLUTION_PLAN.md`  
**Execution Timestamp:** 2026-10-24 14:00:00 UTC+05:30  
**Authors:** Senior Product Architect, Climate Scientist, Full-Stack Engineer, and Statistical Lead  

---

## 1. Executive Mission & Strategic Vision

EarthSift is evolving from a baseline statistical calculator into an **exceptionally useful, dependable, and scientifically defensible Earth-system trend discovery platform**.

Rather than simply adding disconnected widgets or unverified models, EarthSift 2.0 optimizes for:
1. **Scientific Trustworthiness:** Every trend, slope difference, and cluster is grounded in peer-reviewed statistical climatology (Theil-Sen, Mann-Kendall with tie corrections, Hamed-Rao serial correlation adjustments, Benjamini-Hochberg False Discovery Rate control, and Anselin Local Moran's $I$).
2. **Transparent Data Provenance:** Disclosing exact sensor transitions, native spatial grids, metric distance scaling ($55.6 \times \cos\phi\text{ km}$), and annual aggregation levels (`annual_mean` vs monthly).
3. **Core Workflow Excellence:** Guiding users seamlessly through discovery, spatial bounding, temporal qualification, pre-run quality gating, robust trend estimation, regional contrasting, and reproducible reporting.
4. **Differentiated Scientific Intelligence:** Introducing the **Trend Robustness Lab**, **Autonomous Trend Discovery**, **Side-by-Side Regional Detective**, and **Data Quality & Continuity Inspector**.

---

## 2. Comprehensive Forensic Gap Analysis

Across the six core dimensions of scientific software, the following gaps in the existing codebase were identified and prioritized:

```
+---------------------------------------------------------------------------------------------------------+
|                                    EARTHSIFT 2.0 ARCHITECTURAL GAP MATRIX                               |
+-------------------+-------------------------------------------+-----------------------------------------+
| Subsystem         | Current Implementation State              | EarthSift 2.0 Target State              |
+-------------------+-------------------------------------------+-----------------------------------------+
| 1. Variable       | Flat parameter lists with basic names;    | Domain-grouped catalog with physical    |
|    Discovery      | lacks physical domains, verified temporal | meaning, observation/model lineage,     |
|                   | bounds, and suitable analysis types.      | temporal aggregation, and references.   |
+-------------------+-------------------------------------------+-----------------------------------------+
| 2. Quality Gate   | Post-hoc error throwing (e.g. 422 after   | Pre-flight quality gate endpoint        |
|    & Pre-flight   | slice fails); no pre-run suitability     | classifying inputs: SUPPORTED,          |
|                   | rating or actionable remediation advice.  | SUPPORTED WITH LIMITATIONS, or BLOCKED. |
+-------------------+-------------------------------------------+-----------------------------------------+
| 3. Robustness     | Single monotonic slope calculated; user   | Trend Robustness Lab: tests sensitivity |
|    Analysis       | cannot assess sensitivity to date windows | to window bounds, OLS vs Theil-Sen,     |
|                   | or alternative estimators.                | and serial correlation adjustments.     |
+-------------------+-------------------------------------------+-----------------------------------------+
| 4. Regional       | Point-to-point pin comparison (Pin A vs   | Dual-region comparison workflow with    |
|    Comparison     | Pin B); lacks area-to-area contrasting   | formal two-sample slope difference $Z$  |
|                   | and formal slope difference hypothesis.   | test: Z = (m_A - m_B) / sqrt(SE_A²+SE_B²)|
+-------------------+-------------------------------------------+-----------------------------------------+
| 5. Automated      | Candidate signals ranked only within a    | Cross-variable discovery engine ranking |
|    Discovery      | single completed analysis; cannot scan    | signals by FDR q-value, effect size,    |
|                   | multiple variables across a region.       | spatial coherence, and completeness.    |
+-------------------+-------------------------------------------+-----------------------------------------+
| 6. Data Quality   | Basic provenance banner; lacks temporal   | Detailed Data Quality Inspector:        |
|    Inspector      | completeness %, outlier detection, and    | coverage %, gap analysis, outlier vs    |
|                   | metric resolution latitude scaling.       | valid extreme event distinction.        |
+-------------------+-------------------------------------------+-----------------------------------------+
| 7. Reproducibility| Generic JSON/NetCDF export; lacks SHA-256 | Cryptographically reproducible records  |
|    & Export       | snapshot hash and self-contained recipe.  | with analysis fingerprint and recipe.   |
+-------------------+-------------------------------------------+-----------------------------------------+
```

---

## 3. Prioritized Implementation Roadmap

### Phase 1: Core Scientific Workflow & Quality Gate (P0 / P1)
- **Item 1.1 — Enriched Variable Catalog:** Extend `VariableInfo` schema and adapters to return physical domain grouping (`thermal`, `hydrological`, `radiative`, `atmospheric`), temporal coverage bounds, data lineage, and method suitability.
- **Item 1.2 — Pre-Flight Scientific Quality Gate:** Implement `POST /api/v1/analysis/quality-gate` evaluating temporal length, observation count, sensor continuity, and grid intersection before full execution.
- **Item 1.3 — Formal Regional Slope Difference Testing:** Enhance regional comparison to accept dual bounding boxes and compute the two-sample slope divergence Z-statistic:
  $$Z_{\Delta} = \frac{m_A - m_B}{\sqrt{\operatorname{Var}(m_A) + \operatorname{Var}(m_B)}}$$
  with associated two-tailed $p$-value.

### Phase 2: High-Value Scientific Intelligence Capabilities (P1)
- **Item 2.1 — Feature A: Trend Robustness Lab:**
  - Endpoint: `POST /api/v1/analysis/robustness`
  - Evaluates sensitivity to:
    1. Temporal window perturbation (shortening start year by 2–5 yrs, extending end year).
    2. Estimator comparison (Theil-Sen median of slopes vs Ordinary Least Squares linear regression).
    3. Autocorrelation treatment (standard Mann-Kendall vs Hamed-Rao 1998 serial correlation correction).
    4. Outlier robustness (jackknife leave-one-out slope variance).
  - Outputs a definitive stability classification: `ROBUST`, `MODERATELY_SENSITIVE`, or `HIGHLY_SENSITIVE`.
- **Item 2.2 — Feature B: Autonomous Trend Discovery Engine:**
  - Endpoint: `POST /api/v1/analysis/discover-trends`
  - Evaluates all available variables across a user-specified bounding box.
  - Multiplicity-corrected candidate ranking using Benjamini-Hochberg FDR across the discovery family.
- **Item 2.3 — Feature D: Data Quality & Continuity Inspector:**
  - Endpoint: `GET /api/v1/analysis/{analysis_id}/quality-profile`
  - Returns temporal completeness %, missing interval list, extreme anomaly flags (IQR / $3\sigma$), metric resolution scaling ($R \cos\phi \Delta\lambda$), and satellite instrument lineage.
- **Item 2.4 — Feature E: Reproducible Analysis Dossier:**
  - Endpoint: `GET /api/v1/analysis/{analysis_id}/reproducibility`
  - Generates a tamper-evident, SHA-256 hashed reproducibility manifest containing exact parameters, data provenance, Python replication snippet, and mathematical citations.

### Phase 3: Frontend Integration & Cohesive UX
- Update `AnalysisPanel.jsx`, `EvidencePanel.jsx`, `DashboardPage.jsx`, and `helpers.js` to render:
  - Quality Gate status pill and advisory modal.
  - Robustness Lab interactive card with estimator comparison table.
  - Enhanced Regional Detective mode with slope difference hypothesis test.
  - Data Quality Inspector drawer with metric scale indicator.
  - Clean reproducible recipe download.

---

## 4. Rigorous Acceptance Criteria

1. **Determinism & Test Suite Integrity:** Full backend test suite passes with **exit code 0** (expanding from 250 tests to $>265$ comprehensive tests).
2. **Scientific Precision:**
   - Pre-flight quality gate correctly intercepts sub-grid queries, invalid spans, and sensor regime crossings without server errors.
   - Robustness lab computes valid OLS and Theil-Sen comparisons with mathematically verified ground truth.
   - Regional slope difference test produces $Z = 0$ and $p = 1.0$ for identical series, and valid $Z$ for diverging trends.
3. **Frontend Production Build:** `npm run build` in `frontend-react/` compiles cleanly in $<1.5\text{s}$ with zero TypeScript/JSX errors and zero bundle warnings.
4. **Execution Performance:** Robustness and discovery endpoints execute in $<1200\text{ms}$ under vectorized NumPy processing.
