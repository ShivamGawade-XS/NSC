# EarthSift — Remediation Plan & TDD Implementation Strategy (Phase 9)

**Project:** EarthSift — Be An Earth System Trend Detective!  
**Competition:** NASA Space Apps Challenge 2026  
**Phase:** Phase 9 — Remediation Planning and Red/Green/Refactor  
**Execution Timestamp:** 2026-10-24 12:35:00 UTC+05:30  
**Evaluator:** Adversarial Engineering & Scientific Validation Red Team  

---

## 1. Prioritized Remediation Roadmap

Based on the Master Failure Inventory (`NASA_CHALLENGE_MASTER_FINDINGS.md`), three high-impact enhancements and data-integrity fixes are planned:

| Issue ID | Priority | Finding Title | Affected Module(s) | Proposed Resolution | Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PROV-002** | **P1 (High)** | NASA POWER Regional API Sub-2° Bounding Box Rejection | `backend/app/adapters/nasa_power.py` | Automatically expand live query bounds to $\ge 2.0^\circ$ span, then rely on `subset()` to slice to user's exact bounding box. | Live requests for $<2.0^\circ$ bounding boxes query $\ge 2.0^\circ$ from NASA and slice down to exact user extent without HTTP 422 errors. |
| **PROV-001** | **P1 (High)** | Offline Fallback Fixture Variable Substitution | `backend/app/adapters/nasa_power.py`, `backend/app/schemas/analysis.py`, `backend/data/fixtures/` | 1. Add authentic NetCDF fixtures for solar irradiance (`ALLSKY_SFC_SW_DWN`), wind speed (`WS10M`), and relative humidity (`RH2M`).<br>2. Add explicit `is_variable_substituted` flag and caveat warning when target variable is not in fixture. | Querying solar irradiance or wind speed in offline mode never silently outputs `T2M` without setting `is_variable_substituted: True` and attaching an explicit warning. |
| **CLIM-001** | **P2 (Medium)** | Climatological Normal Qualification for Short Time Windows ($<20$ Yrs) | `backend/app/schemas/analysis.py`, `backend/app/api/endpoints.py`, `frontend-react/src/components/EvidencePanel.jsx` | Add `is_climatological_normal: bool` and display an informative badge when time window spans $<20$ years. | Requests spanning $<20$ years emit `is_climatological_normal: False` and a scientific caveat distinguishing short-term environmental variability from 30-year WMO climate normals. |

---

## 2. Test-Driven Development (TDD) Protocols

Every fix follows strict Red-Green-Refactor discipline:
1. **RED:** Author dedicated automated tests in `backend/tests/test_nasa_compliance_rigor.py` that fail prior to code modification.
2. **GREEN:** Implement minimal, surgical changes in `backend/app/adapters/nasa_power.py`, `schemas/analysis.py`, and `api/endpoints.py`.
3. **REFACTOR:** Verify code formatting with `ruff`, static typing with `pyright`, and run full regression suite (238+ tests) to guarantee zero regressions.

---

## 3. Implementation Plan Details

### 3.1 PROV-002: Bounding Box Span Clamping in `fetch_live_granule`
In `backend/app/adapters/nasa_power.py:248-255`:
```python
# Ensure at least a 2.0 degree range in both dimensions as required by NASA POWER regional API
lat_range = max_lat - min_lat
lon_range = max_lon - min_lon
req_min_lat = min_lat
req_max_lat = min_lat + max(2.0, min(lat_range, 9.9))
if req_max_lat > 90.0:
    req_max_lat = 90.0
    req_min_lat = max(-90.0, 90.0 - max(2.0, min(lat_range, 9.9)))

req_min_lon = min_lon
req_max_lon = min_lon + max(2.0, min(lon_range, 9.9))
if req_max_lon > 180.0:
    req_max_lon = 180.0
    req_min_lon = max(-180.0, 180.0 - max(2.0, min(lon_range, 9.9)))
```

### 3.2 PROV-001: Fixture Variable Alignment & Transparency Flag
1. Generate authentic fixtures for `ALLSKY_SFC_SW_DWN`, `WS10M`, and `RH2M` in `backend/data/fixtures/` using NASA POWER climatological distributions.
2. In `backend/app/adapters/nasa_power.py:376-383`:
   ```python
   is_var_substituted = bool(target_var not in (nasa_param, variable))
   ```
   Pass `is_variable_substituted: is_var_substituted` to the returned provenance dict.
3. In `backend/app/schemas/analysis.py`, add `is_variable_substituted: bool = Field(default=False)` to `ProvenanceResponse`.

### 3.3 CLIM-001: Climatological Normal Qualification
1. In `backend/app/schemas/analysis.py`, add:
   ```python
   is_climatological_normal: bool = Field(
       default=True,
       description="True if temporal window spans at least 20 years, qualifying as a climatological trend rather than short-term environmental variability."
   )
   ```
2. In `backend/app/api/endpoints.py:228`:
   ```python
   is_clim_normal = (req.end_year - req.start_year + 1) >= 20
   ```
   Forward `is_climatological_normal=is_clim_normal` in `SummaryStatistics`.
3. In `frontend-react/src/components/EvidencePanel.jsx`, display a badge when `is_climatological_normal === false`.

---

## 4. Remediation Schedule & Verification Gates

- **Gate 1:** Red tests added and failing.
- **Gate 2:** Fixes applied and Red tests turn Green.
- **Gate 3:** Full 238+ test suite passes, 0 pyright errors, 0 ruff errors, frontend builds cleanly.
- **Gate 4:** Final adversarial regression and release decision in Phase 10 (`NASA_CHALLENGE_FINAL_ADVERSARIAL_VALIDATION.md`).
