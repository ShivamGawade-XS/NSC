# EarthSift — Post-Release Prioritized Engineering & Science Backlog
## Deferred P2/P3 Enhancements, Scientific Research Items & Long-Term Roadmap

**Project:** EarthSift — Autonomous Spatial Trend Discovery Instrument  
**Competition:** NASA Space Apps Challenge 2026 — *"Be An Earth System Trend Detective!"*  
**Document:** `NASA_CHALLENGE_PRIORITIZED_BACKLOG.md`  
**Execution Timestamp:** 2026-10-24 13:54:00 UTC+05:30  
**Context:** P0/P1 Critical Remediation Complete & Verified (Release Certified)  

---

## 1. Backlog Prioritization Schema

With all P0 and P1 blocking defects fully resolved, this backlog categorizes non-blocking enhancements, domain specialist consultations, and next-generation capabilities:

- **P2 (Medium Priority):** High-value scientific extensions and testing infrastructure enhancements suitable for Post-Hackathon v1.1.
- **P3 (Low Priority):** Extended exploratory features, additional atmospheric variables, and new export formats for v1.2+.

---

## 2. Prioritized Item Register

### P2-001: Satellite Sensor Cross-Calibration Transfer Function (Atmospheric Science)
- **Domain:** Data Fusion / Radiative Transfer
- **Description:**
  Currently, `ALLSKY_SFC_SW_DWN` trend estimation across the 2000/2001 GEWEX SRB $\to$ CERES transition is blocked to prevent false discovery.
  To enable seamless multi-decadal solar trend analysis (1984–present), develop an empirical transfer function or quantile-mapping harmonization model trained during the overlapping observation window (March 2000 – December 2000).
- **Prerequisites:**
  Formal consultation with NASA Langley POWER / CERES science teams to ensure alignment with official CERES Edition 4.1 harmonization guidelines.
- **Estimated Effort:** 3–4 weeks (research + validation).

---

### P2-002: Headless Browser E2E Automation Pipeline (Engineering & QA)
- **Domain:** Quality Assurance / Full-Stack Testing
- **Description:**
  While backend API integration pipelines are thoroughly tested across 250 unit/integration tests and frontend builds clean with zero errors, introduce automated headless browser test execution (Playwright / Chromium).
  Automate DOM interaction validation:
  - Map click-to-coordinate bounding box selection.
  - Interactive Leaflet heatmap tile rendering verification.
  - Chart.js canvas rendering and hover tooltip inspection.
  - Browser memory leak checks during repeated multi-megabyte NetCDF visual rendering.
- **Implementation Target:** `frontend-react/e2e/user-journey.spec.js` running in GitHub Actions CI.
- **Estimated Effort:** 1 week.

---

### P2-003: Multi-Dataset Inter-Comparison & Agreement Metric (Science & UX)
- **Domain:** Data Inter-comparison / Statistical Robustness
- **Description:**
  Enable simultaneous dual-adapter execution comparing NASA POWER and NASA MERRA-2 trends for identical spatial-temporal bounds (e.g. 2-meter air temperature over North America from 1981–2023).
  Compute a spatial Trend Agreement Index (TAI) and display a dual-histogram showing slope divergence between reanalysis assimilation (MERRA-2) and blended satellite-gauge products (POWER).
- **Estimated Effort:** 2 weeks.

---

### P2-004: Point-Mode Graceful Fallback for Sub-Grid Coordinates (UX & API)
- **Domain:** API Resilience / Spatial Usability
- **Description:**
  Currently, sub-grid queries with zero cell centers return HTTP 422 with an actionable error.
  Enhance this workflow by offering an automatic fallback: when a user clicks a point or draws a bounding box $< 0.5^\circ$, detect the sub-grid condition and seamlessly route the query to NASA POWER's Point API (`/api/temporal/monthly/point`), retrieving the nearest-neighbor time series without requiring manual box expansion.
- **Estimated Effort:** 3 days.

---

### P3-001: Extended Earth System Variables (Science Ingestion)
- **Domain:** Atmospheric Chemistry & Cloud Physics
- **Description:**
  Incorporate additional NASA POWER and MERRA-2 variables to expand EarthSift's trend detection capabilities:
  1. `AOD` (Aerosol Optical Depth from MODIS / MERRA-2 Aerosol reanalysis) for particulate pollution and wildfire smoke trend tracking.
  2. `CLDFRC` (Total Cloud Area Fraction) for cloud feedback analysis.
  3. `ALBEDO` (Surface All-Sky Albedo) for cryosphere and land-cover change detection.
- **Estimated Effort:** 1.5 weeks.

---

### P3-002: Cloud-Optimized GeoTIFF (COG) and Zarr Export Formats (Data Interoperability)
- **Domain:** Scientific Data Publishing / GIS Integration
- **Description:**
  Expand EarthSift's existing export pipeline (which currently supports NetCDF-4, GeoJSON, and CSV) to generate:
  - Cloud-Optimized GeoTIFF (COG) with embedded internal pyramid overviews for immediate QGIS / ArcGIS drag-and-drop.
  - Zarr storage groups for cloud-native parallel chunk access in Pangeo / Jupyter environments.
- **Estimated Effort:** 1 week.

---

## 3. Implementation Phasing

```
+-------------------------------------------------------------------------------+
|                       EARTHSIFT POST-RELEASE PHASING                          |
+-------------------+---------------------------------------+-------------------+
| Phase             | Deliverables                          | Target Timeline   |
+-------------------+---------------------------------------+-------------------+
| Release v1.0.0    | P0/P1 Fixes, Verified 250 Tests,      | CURRENT (RELEASE) |
| (Competition)     | Certified Scientific Guardrails       |                   |
+-------------------+---------------------------------------+-------------------+
| Release v1.1.0    | Point-Mode Fallback (P2-004),         | Q1 2027           |
| (Enhancement)     | Playwright E2E Suite (P2-002),        |                   |
|                   | Dual-Dataset TAI Agreement (P2-003)   |                   |
+-------------------+---------------------------------------+-------------------+
| Release v2.0.0    | Solar Cross-Calibration (P2-001),     | Q2 2027           |
| (Research Hub)    | Extended Aerosol/Cloud Vars (P3-001), |                   |
|                   | COG / Zarr Cloud Streams (P3-002)     |                   |
+-------------------+---------------------------------------+-------------------+
```
