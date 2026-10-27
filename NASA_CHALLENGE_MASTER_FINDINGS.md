# EarthSift — Master Failure Inventory & Root Cause Analysis (Phase 8)

**Project:** EarthSift — Be An Earth System Trend Detective!  
**Competition:** NASA Space Apps Challenge 2026  
**Phase:** Phase 8 — Consolidated Failure Inventory & Root Cause Analysis  
**Execution Timestamp:** 2026-10-24 12:33:00 UTC+05:30  
**Evaluator:** Adversarial Engineering & Scientific Validation Red Team  

---

## 1. Inventory Ranking & Severity Methodology

All findings discovered across the adversarial audit have been reproduced, verified with concrete code evidence, and ranked by real-world scientific, security, and operational impact.

---

## 2. Master Findings Inventory

### Finding PROV-001: Offline Fallback Fixture Variable Substitution
- **Severity:** **High** | **Confidence:** **High** | **Status:** **CONFIRMED**
- **Affected Files:** `backend/app/adapters/nasa_power.py:350–383`
- **Concrete Evidence:**  
  `backend/data/fixtures/` contains only `nasa_merra2_t2m_na.nc`, `nasa_merra2_precip_na.nc`, and `merra2_reanalysis.nc`. If a user queries solar irradiance (`ALLSKY_SFC_SW_DWN`), wind speed (`WS10M`), or relative humidity (`RH2M`), and live download fails or is offline, line 377–382 falls back to `nasa_merra2_t2m_na.nc` and selects `T2M`.
- **Scientific Impact:**  
  **Produces a plausible-looking but scientifically incorrect result in offline mode.** Temperature values in Celsius are returned and labeled as solar irradiance ($MJ/m^2/day$) or wind speed ($m/s$). While `is_fallback_fixture: true` is attached, the user is never told that the physical values are temperature substitutions.
- **Root Cause:** No dedicated offline fixtures exist for solar, wind, or humidity; the fixture reader defaults to `T2M` if the target variable is missing from the NetCDF dataset.
- **Proposed Remediation:**
  1. Add authentic pre-bundled NetCDF fixtures for solar irradiance (`nasa_power_allsky_sfc_sw_dwn_na.nc`), wind speed (`nasa_power_ws10m_na.nc`), and relative humidity (`nasa_power_rh2m_na.nc`).
  2. In `nasa_power.py`, explicitly detect if the loaded variable does not match the requested variable, setting `is_variable_substituted: true` and attaching a prominent warning.
- **Required Regression Test:** `test_offline_fixture_variable_fidelity` verifying that requesting `ALLSKY_SFC_SW_DWN` or `WS10M` in fixture mode never silently outputs `T2M` data without an explicit substitution flag.

---

### Finding PROV-002: Sub-2° Bounding Boxes Trigger NASA Regional API HTTP 422
- **Severity:** **High** | **Confidence:** **High** | **Status:** **CONFIRMED**
- **Affected Files:** `backend/app/adapters/nasa_power.py:248–255`
- **Concrete Evidence:**  
  Direct HTTP query to NASA POWER with $\Delta\text{lat} < 2.0^\circ$ or $\Delta\text{lon} < 2.0^\circ$ returns:  
  `HTTP 422: {"messages": ["Please provide at least a 2 degree range in latitude; otherwise use the point endpoint.", "Please provide at least a 2 degree range in longitude; otherwise use the point endpoint."]}`
- **Actual Behavior:** `fetch_live_granule` catches HTTP 422 and prematurely aborts live retrieval, forcing an unnecessary fallback to offline fixtures for small regional bounding boxes.
- **Root Cause:** `nasa_power.py` clamped maximum delta to 9.9 degrees, but failed to enforce the 2.0-degree minimum span required by NASA POWER's regional endpoint.
- **Proposed Remediation:**  
  In `fetch_live_granule`, compute:
  ```python
  req_max_lat = req_min_lat + max(2.0, min(lat_range, 9.9))
  req_max_lon = req_min_lon + max(2.0, min(lon_range, 9.9))
  ```
  This queries an authentic $\ge 2.0^\circ$ regional tile from NASA, which `subset()` subsequently slices to the user's exact bounding box.
- **Required Regression Test:** `test_nasa_power_sub_2_degree_live_query_expansion` verifying that a $1.0^\circ \times 1.0^\circ$ bounding box requests $\ge 2.0^\circ$ from NASA and slices correctly.

---

### Finding CLIM-001: Short Time Windows Conflate Weather Variability with Climate Trends
- **Severity:** **Medium** | **Confidence:** **High** | **Status:** **CONFIRMED**
- **Affected Files:** `backend/app/schemas/analysis.py:59`, `frontend-react/src/components/EvidencePanel.jsx`
- **Concrete Evidence:**  
  Analysis requests accept time windows down to 5 years (`start_year=2018, end_year=2023`). WMO standard climatological normals require 30 years (e.g., 1991–2020) to decouple persistent anthropogenically driven trends from decadal internal climate oscillations (ENSO, PDO, AMO).
- **Scientific Impact:**  
  Users investigating a 5-to-10-year period may interpret an ENSO-driven 5-year cooling or warming anomaly as a secular climate change trend.
- **Root Cause:** Bounding rule permits 5 years for short-term disaster tracking, but the UI labels all results identically as "Decadal Climate Trend".
- **Proposed Remediation:**  
  Add `is_climatological_normal: bool = Field(default=False)` in `AnalysisResponse`. When `end_year - start_year + 1 < 20`, emit an informative caveat badge in the UI and dossier: *"Short-Term Environmental Variability (< 20 Years) — Not A 30-Year Climatological Normal"*.
- **Required Regression Test:** `test_climatological_normal_qualification_flag` verifying that time windows $<20$ years emit the short-term qualification badge.

---

### Finding RED-001: Plaintext Netrc Credential Storage on Disk
- **Severity:** **Low** | **Confidence:** **High** | **Status:** **CONFIRMED**
- **Affected Files:** `backend/app/core/config.py:110–150`
- **Concrete Evidence:**  
  `setup_netrc()` writes NASA Earthdata credentials to `~/_netrc`. While Windows DACL restricts file access to the current user, credentials remain in plaintext on disk.
- **Root Cause:** Standard NASA `earthaccess` library relies on local `.netrc` files.
- **Proposed Remediation:**  
  Bypass disk file creation if `EARTHDATA_USERNAME` and `EARTHDATA_PASSWORD` are already provided via runtime environment variables; use in-memory credentials directly.
- **Required Regression Test:** `test_netrc_memory_bypass` verifying zero disk writes when environment authentication is active.

---

### Finding ARCH-001: Unused Legacy Prototype Directory (`/frontend`)
- **Severity:** **Low** | **Confidence:** **High** | **Status:** **CONFIRMED**
- **Affected Files:** `frontend/` (contains vanilla HTML/JS prototype files)
- **Concrete Evidence:**  
  `backend/app/main.py:270` exclusively mounts `frontend-react/dist`. The root `frontend/` folder is never accessed by the production server.
- **Root Cause:** Prototype files retained during React 19 migration.
- **Proposed Remediation:** Mark `frontend/` as deprecated in documentation.

---

## 3. Historical Remediations Re-Audit (SEC-001 through SEC-006)

| Finding ID | Title | Re-Audit Status | Regression Test Status |
| :--- | :--- | :--- | :--- |
| **SEC-001** | Custom Spatial Analysis Resource Exhaustion | **REMEDIATED & VERIFIED** | `test_sec_001_custom_analysis_resource_exhaustion_guards` (PASS) |
| **SEC-002** | Production Signing Secret Fallback Risk | **REMEDIATED & VERIFIED** | `test_secret_key_production_enforcement` (PASS) |
| **SEC-003** | Windows `_netrc` Insecure Permissions | **REMEDIATED & VERIFIED** | `test_netrc_file_permissions_isolation` (PASS) |
| **SEC-004** | Content-Disposition Filename Injection | **REMEDIATED & VERIFIED** | `test_sec_004_attachment_filename_sanitization_defense` (PASS) |
| **SEC-005** | Cache-Control Header Leakage Defense | **REMEDIATED & VERIFIED** | `test_sec_005_cache_control_headers` (PASS) |
| **SEC-006** | Production Uvicorn Reload Gating | **REMEDIATED & VERIFIED** | `test_sec_006_uvicorn_reload_gating` (PASS) |

---

## 4. Phase 8 Conclusion

The consolidated failure inventory is finalized. Two actionable high-severity scientific data findings (**PROV-001** and **PROV-002**) and one medium-severity climatological framing finding (**CLIM-001**) have been isolated with exact root causes and proposed remediations.

**Phase 8 Complete.** All initial audit reports are delivered. Proceeding to Phase 9: Remediation Planning and Red/Green/Refactor.
