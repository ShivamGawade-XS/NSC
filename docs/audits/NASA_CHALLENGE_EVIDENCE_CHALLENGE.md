# EarthSift — Independent Evidence Challenge: Verify or Retract
## Adversarial Evidence Audit & Formal Retraction Notice

**Document:** `NASA_CHALLENGE_EVIDENCE_CHALLENGE.md`  
**Execution Timestamp:** 2026-10-24 13:30:00 UTC+05:30  
**Audit Standard:** Strict Scientific & Forensic Verification (Zero Manufactured Evidence, Empirical Replication Required)  
**Target Document Under Review:** `NASA_CHALLENGE_FINAL_ADVERSARIAL_VALIDATION.md`  

---

## 1. Executive Summary & Audit Mandate

This document presents the results of an independent, adversarial audit challenging the claims made in `NASA_CHALLENGE_FINAL_ADVERSARIAL_VALIDATION.md` and associated Phase 0–10 reports.

Every material claim regarding test counts, live NASA POWER endpoint behaviors, temporal dimensions, spatial resolutions, climatological definitions, security posture, and full-stack user journeys has been subjected to foreground execution, source code inspection, network probes, and mathematical validation.

### Core Verdict
Multiple high-severity claims in previous audit reports are **demonstrably INCORRECT** or **UNSUBSTANTIATED**. Most critically:
1. **The Claim of 559 Continuous Monthly Records is INCORRECT:** NASA POWER returns 516 monthly values and 43 annual summary values (`YYYY13`). EarthSift actually executes its trend analysis on the **43 annual values**, not 559 monthly records.
2. **The 241-Passing Test Claim is FAILED (1 FAILED, 240 PASSED):** Running `pytest backend/tests` in the real foreground environment produces an exit code of `1` due to a state-dependent cache collision in `test_prov_002_nasa_power_sub_2_degree_live_query_expansion`.
3. **Sub-Grid Regional Queries Crash with Unhandled 500:** Bounding boxes falling between native grid points cause an unhandled `ValueError` in `endpoints.py:297` (`np.max(slopes)` on empty array).
4. **End-to-End User Journey Tests are NOT Browser Tests:** Automated tests in `test_end_to_end_user_journey.py` are FastAPI `TestClient` API tests; no browser or UI DOM was exercised.
5. **WMO Climatological Normal is Confused with Trend Duration:** Calling a 20-year trend an `is_climatological_normal: True` is a category error in atmospheric science. A normal is a 30-year reference baseline average ($\mu$), not a regression slope ($m$).
6. **False Solar Trends Across Satellite Discontinuities Remain Computable:** The application computes and exports numerical slopes for solar irradiance across the 2000/2001 SRB-to-CERES transition, which can manufacture artificial climate trends from calibration offsets.

---

## 2. Comprehensive Evidence Verification Matrix

| Claim ID | Exact Prior Report Claim | Evidence Inspected | Independent Verification Procedure | Actual Outcome | Status | Severity & Confidence | Reproduction Instructions | Required Corrective Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **EV-001** | *"Live NASA POWER probe returned 559 continuous monthly records covering 43 years."* | `NASA_CHALLENGE_FINAL_ADVERSARIAL_VALIDATION.md:33`, `backend/app/adapters/nasa_power.py:401-410` | Executed live query to `https://power.larc.nasa.gov/api/temporal/monthly/regional` for 1981–2023. Inspected returned JSON keys and NetCDF coordinates. | Returned 559 total entries per cell: **516 monthly observations** (`YYYY01`–`YYYY12`) and **43 annual averages** (`YYYY13`). EarthSift's code explicitly filters for `t % 100 == 13`, analyzing **43 annual slices**, not 559 monthly records. | **INCORRECT** | **HIGH** / **VERY HIGH** | Run `python -c "import urllib.request, json; r=urllib.request.urlopen('https://power.larc.nasa.gov/api/temporal/monthly/regional?latitude-min=30&latitude-max=32&longitude-min=-95&longitude-max=-93&parameters=T2M&community=AG&start=1981&end=2023&format=JSON'); d=json.loads(r.read()); print(len(d['features'][0]['properties']['parameter']['T2M']))"` | Retract claim of "559 continuous monthly records". Disclose that NASA POWER monthly API returns 516 months + 43 annual means (`YYYY13`), and that EarthSift conducts annual-mean trend analysis on 43 points. |
| **EV-002** | *"Pytest Full Suite: 241 passed in 64.75s (0 failed, 0 skipped, 0 xfailed), Exit Code 0."* | `NASA_CHALLENGE_FINAL_ADVERSARIAL_VALIDATION.md:33`, foreground `pytest` execution | Executed `python -m pytest backend/tests --tb=short` in foreground with existing repository state. | **1 FAILED, 240 PASSED** in 54.24s (Exit Code `1`). `test_prov_002_nasa_power_sub_2_degree_live_query_expansion` failed with `assert 0 > 0` (`len(requested_urls) == 0`) because a prior live query populated the cache on disk, bypassing `urlopen`. | **INCORRECT** | **HIGH** / **VERY HIGH** | Run live query creating `power_T2M_2020_2021_b638b58040fb.nc` in `backend/data/nasa_granules/`, then run `pytest backend/tests/test_nasa_compliance_rigor.py::test_prov_002_nasa_power_sub_2_degree_live_query_expansion`. | Mock or isolate `cache_dir` in `test_prov_002` using a temporary directory fixture (`tmp_path`) so cache hits on disk do not bypass `urlopen`. |
| **EV-003** | *"NASA POWER provides a general 0.5° × 0.5° grid at approximately 55 km resolution."* | `EvidencePanel.jsx:362`, `backend/app/adapters/merra2.py:47`, `backend/app/adapters/nasa_power.py:48` | Calculated metric distance for $0.5^\circ$ longitude at varying latitudes: $\Delta x = R \cos(\phi) \Delta \lambda \frac{\pi}{180}$. Inspected UI components. | $0.5^\circ$ is ~55.6 km **only at the equator**. At $45^\circ\text{N}$, $0.5^\circ \approx 39.3\text{ km}$; at $60^\circ\text{N}$, $0.5^\circ \approx 27.8\text{ km}$. Furthermore, MERRA-2 native longitude resolution is $0.625^\circ$, and CERES native resolution is $1.0^\circ \times 1.0^\circ$. `EvidencePanel.jsx:362` hardcodes `"0.5° × 0.5° NASA Reanalysis Assimilation"` regardless of variable or latitude. | **INCORRECT** | **MEDIUM** / **VERY HIGH** | Inspect line 362 of `EvidencePanel.jsx`. Calculate longitude distance at $\phi=60^\circ$. | Dynamically format resolution metadata based on dataset (`0.5° × 0.625°` for MERRA-2, `1.0°` for CERES), and clarify that physical distance in km scales with $\cos(\text{latitude})$. |
| **EV-004** | *"Sub-2-degree regional queries clamp min delta to >= 2.0 degrees to prevent NASA HTTP 422... Subsets back to exact user coordinates."* | `backend/app/adapters/nasa_power.py:246-265`, `backend/app/api/endpoints.py:286-300` | Tested bounding boxes that fall between grid lines (e.g. `[-94.9, 30.1, -94.7, 30.3]`). | When the requested bounding box falls between grid points, `sub_da.sel` returns an empty array of shape `(T, 0, 0)`. `endpoints.py:297` executes `np.max(slopes)` on empty array, causing an **unhandled 500 Server Error** (`ValueError: zero-size array to reduction operation maximum which has no identity`). | **INCORRECT** | **CRITICAL** / **VERY HIGH** | Send `POST /analysis` with `bbox=[-94.9, 30.1, -94.7, 30.3]`, `start_year=2018`, `end_year=2023`, `dataset_id='nasa_power'`. Observe unhandled 500 exception trace. | Add guard in `endpoints.py` and `NASAPowerAdapter.fetch()`: if sliced array has 0 cells, return HTTP 422 stating "No grid cells intersect the requested bounding box at 0.5° resolution. Expand bounding box or select a region intersecting grid centers." Alternatively, snap to nearest grid cell. |
| **EV-005** | *"Climatological normal qualification flag (CLIM-001): Windows >= 20 years qualify as climatological normals."* | `backend/app/schemas/analysis.py:163-172`, `backend/app/api/endpoints.py:286-294`, WMO-No. 1203 | Compared EarthSift's `is_climatological_normal` flag against WMO Guidelines on Climate Normals (WMO-No. 1203). | **Category Error.** In atmospheric science, a "Climatological Normal" is a 30-year **reference baseline mean** (e.g., 1991–2020 average temperature $\bar{T}$), NOT a trend slope ($dT/dt$). EarthSift computes non-parametric monotonic trend slopes, not baseline normals. Labeling a 24-year trend `is_climatological_normal: True` confuses climatological duration with a climatological standard normal. | **INCORRECT** | **HIGH** / **VERY HIGH** | View `backend/app/schemas/analysis.py:163` and WMO-No. 1203 documentation. | Rename field to `is_climatological_span` or `meets_climatological_duration_threshold`. Clarify in documentation and UI that this indicates an observation span $\ge 20$ years sufficient to detect climate trends rather than short-term interannual variability. |
| **EV-006** | *"Solar radiation sensor discontinuity warning and provenance prevents misleading anthropogenic trend claims."* | `backend/app/adapters/nasa_power.py:98-100`, `backend/app/science/export.py:100-150` | Inspected whether `POST /analysis` or exports prevent or invalidate long-term trend calculations across the 2000/2001 SRB $\to$ CERES transition. | While a text badge is displayed in the UI, EarthSift **still calculates, visualizes, and exports numerical Theil-Sen slopes and Mann-Kendall p-values** across 1985–2020 for `ALLSKY_SFC_SW_DWN`. A user or automated consumer receives a quantitative trend (e.g., $+2.4 \text{ W/m}^2/\text{decade}$) that can be purely an artifact of the satellite sensor shift. | **PARTIALLY VERIFIED** | **HIGH** / **VERY HIGH** | Query `ALLSKY_SFC_SW_DWN` from 1985 to 2020; verify that `slopes`, `p_values`, NetCDF, and GeoJSON exports are generated without truncation or unavailability. | When a requested solar trend window crosses the 2000/2001 boundary, either: (1) refuse to compute a single slope and require splitting into pre-2001 and post-2001 regimes, or (2) stamp the exported data arrays with an explicit invalidity flag for cross-regime trends. |
| **EV-007** | *"Six security probes blocked (SEC-001 through SEC-006 confirmed immune)."* | `scripts/test_red_team_audit.py`, `backend/app/main.py:26`, `backend/app/core/config.py:47-67` | Inspected test implementations in `test_red_team_audit.py` and `test_security_hardening.py`. | **Partially Verified with Documentation Discrepancies:** (1) The test script claimed "Request Body Size Guard (10MB limit)", but the code in `main.py:26` actually enforces `MAX_CONTENT_LENGTH = 2 * 1024 * 1024` (2MB). (2) SEC-002 production check in `config.py` is bypassed if `pytest` is in `sys.modules`, requiring `_is_pytest=False` override in tests. Real defenses are active, but audit report figures were inaccurate. | **PARTIALLY VERIFIED** | **MEDIUM** / **HIGH** | Check line 26 of `backend/app/main.py` (`2MB`) vs `test_red_team_audit.py:57` (`10MB`). | Correct documentation to state 2MB maximum payload body. Ensure production startup scripts test outside of pytest context. |
| **EV-008** | *"End-to-End User Journey Tests: Validated all 15 milestones from catalog discovery to multi-format exports."* | `backend/tests/test_end_to_end_user_journey.py` | Inspected testing harness, imports, and execution mechanics in `test_end_to_end_user_journey.py`. | `test_end_to_end_user_journey.py` imports `fastapi.testclient.TestClient`. It tests the **FastAPI HTTP API routing**, not the frontend React SPA. No browser, DOM renderer, Leaflet map, Chart.js canvas, or WebWorker was executed in automated regression. Calling this a "full user journey break test" conflates API integration testing with genuine browser E2E validation. | **UNSUBSTANTIATED** | **MEDIUM** / **VERY HIGH** | View imports in `backend/tests/test_end_to_end_user_journey.py`. Note absence of Playwright or Selenium. | Clearly label `test_end_to_end_user_journey.py` as "API Pipeline Integration Tests". Separate browser UI validation from automated backend test suites. |

---

## 3. Deep-Dive Findings

### 3.1 The 559 vs. 516 Records Investigation (EV-001)
- **NASA API Request:**
  `https://power.larc.nasa.gov/api/temporal/monthly/regional?latitude-min=30.0&latitude-max=32.0&longitude-min=-95.0&longitude-max=-93.0&parameters=T2M&community=AG&start=1981&end=2023&format=JSON`
- **NASA API Response:** HTTP 200 OK.
- **Timestamp Decomposition:**
  - NASA POWER provides 13 keys per calendar year in monthly temporal queries.
  - Keys `YYYY01` through `YYYY12` represent monthly averages ($43 \times 12 = 516$ months).
  - Key `YYYY13` represents the pre-calculated **annual mean** for that calendar year ($43 \times 1 = 43$ annual records).
  - Total keys returned: $516 + 43 = 559$.
- **Discrepancy in Audit Reports:**
  Prior reports asserted that EarthSift ingested and analyzed "559 continuous monthly records". This is factually incorrect. In `backend/app/adapters/nasa_power.py:404–409`, EarthSift explicitly isolates `t % 100 == 13`. Therefore, EarthSift analyzes **43 annual means**, NOT 559 monthly observations. Calling the series "559 continuous monthly records" misrepresents the temporal aggregation level of the underlying statistical tests.

### 3.2 Sub-Grid Bounding Box Crash (EV-004)
- **The Defect:** When a user specifies a bounding box smaller than the dataset resolution that happens not to contain a grid coordinate (e.g. `min_lon=-94.9, min_lat=30.1, max_lon=-94.7, max_lat=30.3` on a $0.5^\circ$ lattice):
  1. `sub_da = da.sel(...)` produces an array with shape `(years, 0, 0)`.
  2. `compute_spatial_trends` returns empty arrays for `slopes`, `p_values`, etc.
  3. In `endpoints.py:297`:
     ```python
     max_slope = round(float(np.max(slopes)), 4)
     ```
     NumPy raises `ValueError: zero-size array to reduction operation maximum which has no identity`.
  4. The request fails with HTTP 500 instead of a clean, structured validation error.
- **NASA Service Requirement:**
  NASA POWER Regional API explicitly requires:
  `"Please provide at least a 2 degree range in latitude; otherwise use the point endpoint."`
  Expanding queries to $2^\circ$ prevents the upstream NASA 422, but slicing back down in memory without checking cell count creates an internal server crash.

### 3.3 Flawed Test Isolation in PROV-002 (EV-002)
- **Failure Mechanism:**
  In `test_prov_002_nasa_power_sub_2_degree_live_query_expansion`, the test mocks `urllib.request.urlopen` and checks `assert len(requested_urls) > 0`.
  However, `fetch_live_granule` checks if the NetCDF file already exists in `self.cache_dir`.
  If a previous test or live probe has downloaded that granule, `fetch_live_granule` loads from disk and **never calls `urlopen`**.
  As a result, `requested_urls` remains empty (`[]`), causing `assert len(requested_urls) > 0` to fail with `assert 0 > 0`.
- **Significance:** A test that passes only when disk caches are empty and fails after any real data is retrieved is an invalid regression test.

---

## 4. Retraction Notice

The statement in `NASA_CHALLENGE_FINAL_ADVERSARIAL_VALIDATION.md` declaring:
> *"Pytest Full Suite: 241 passed in 64.75s (0 failed, 0 skipped, 0 xfailed) - Status: PASSED"*

is hereby **RETRACTED**. The actual state of the repository test suite when executed in the real foreground environment is:
> **1 FAILED, 240 PASSED (Exit Code: 1)**

The statement declaring:
> *"The variable provenance registry is 100% verified against live NASA API endpoints (559 continuous monthly records)"*

is hereby **RETRACTED**. The 559 timestamps contain 43 annual summary slices (`YYYY13`), and EarthSift's trend engine runs exclusively on the 43 annual averages.
