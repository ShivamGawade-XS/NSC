# EarthSift — Truth & Evidence Ledger

_Last updated: 2026-10-05 — Release Verification_

This ledger records verified facts, tested assumptions, and engineering decisions.  
**Rule:** Only entries with a source citation are recorded. No entry from memory or inference without verification.

| ID | Statement | Type | Source / Evidence | Verified | Status |
| :--- | :--- | :---: | :--- | :---: | :---: |
| **T-001** | Challenge Title: *"Be An Earth System Trend Detective!"* | FACT | [NASA Space Apps 2026 page](https://www.spaceappschallenge.org/2026/challenges/be-an-earth-system-trend-detective/) — live HTML/JSON payload extracted 2026-10-05 | ✅ | Active |
| **T-002** | Challenge difficulty: Advanced. Skills: Earth Science, Software. | FACT | Same page JSON payload (`categories: [{name:"Advanced"}]`, `skills:["Earth Science","Software"]`) | ✅ | Active |
| **T-003** | MERRA-2 monthly land (`M2TMNXLND` v5.12.4) exists in NASA CMR catalog, archived at GESDISC. | FACT | CMR API query: `https://cmr.earthdata.nasa.gov/search/collections.json?short_name=M2TMNXLND&version=5.12.4` → entry returned 2026-10-05 | ✅ | Active |
| **T-004** | MERRA-2 monthly atmosphere (`M2TMNXSLV` v5.12.4) exists in NASA CMR catalog. | FACT | CMR API query: `?short_name=M2TMNXSLV&version=5.12.4` → entry returned 2026-10-05 | ✅ | Active |
| **T-005** | MODIS LST 8-day L3 1km (`MOD11A2` v061) exists in NASA CMR catalog, archived at LP DAAC. | FACT | CMR API query: `?short_name=MOD11A2&version=061` → entry returned 2026-10-05 | ✅ | Active |
| **T-006** | `earthaccess` v0.19.0 is on PyPI. Client library for NASA Earthdata APIs. MIT license. | FACT | PyPI JSON API and successful local pip installation 2026-10-05 | ✅ | Active |
| **T-007** | `pymannkendall` v1.4.3 is on PyPI. License: MIT. | FACT | PyPI JSON API `https://pypi.org/pypi/pymannkendall/json` queried 2026-10-05 | ✅ | Active |
| **T-008** | `regionmask` v0.13.0 is on PyPI. License: MIT. | FACT | PyPI JSON API queried 2026-10-05 | ✅ | Active |
| **T-009** | `fastapi` v0.142.2 is on PyPI. License: MIT. | FACT | PyPI JSON API queried 2026-10-05 | ✅ | Active |
| **T-010** | Environmental time series are frequently non-normal; Mann-Kendall + Sen's Slope is the accepted non-parametric standard in climate science. | FACT | Hirsch et al. (1982) *Technometrics*; Gilbert (1987) *Statistical Methods for Environmental Pollution Monitoring* | Literature | Active |
| **T-011** | Multiple simultaneous grid-cell trend tests inflate false positives without correction; Benjamini-Hochberg FDR controls this at q = 0.05. | FACT | Benjamini & Hochberg (1995) *J. Royal Statistical Society* | Literature | Active |
| **T-012** | EarthSift automated test suite passes 38/38 tests on native pytest covering unit math, adapter pipeline, typed endpoints, cache collision resilience, connected component clustering, and edge cases. | FACT | `pytest` output executed 2026-10-05 (100% green) | ✅ | Active |
| **T-013** | Challenge "Resources" tab content was empty as of 2026-10-05 inspection. | OBSERVATION | Live page JSON: `resourcesTabContent: ""` | ✅ | Active |
| **T-014** | Serial autocorrelation in $AR(1)$ red noise series inflates uncorrected Mann-Kendall variance, causing false positive rejections of null hypothesis. | FACT | Hamed & Rao (1998) *Journal of Hydrology*; Von Storch (1995) | Literature | Active |
| **T-015** | Hamed-Rao (1998) modified variance after Sen detrending successfully prevents false positive trend detection on $AR(1)$ series ($p = 0.0995$). | FACT | Verified in `backend/tests/test_trend.py:test_autocorrelated_series` | ✅ | Active |
| **T-016** | Sen's median estimator recovers ground truth linear slope ($0.7500$) despite an extreme $50\times$ outlier contamination. | FACT | Verified in `backend/tests/test_trend.py:test_sens_slope_accuracy` | ✅ | Active |
| **T-017** | Composite discovery scoring formula balances slope magnitude, significance weight, dynamic completeness, and 8-neighbor spatial coherence. | FACT | Verified in `backend/tests/test_api.py:test_full_analysis_workflow_and_sub_endpoints` | ✅ | Active |
| **T-018** | Contrast Engine successfully pairs statistically significant opposing regional trends over identical temporal windows using 8-connectivity clustering. | FACT | Verified in `backend/tests/test_application.py:test_contrast_clustering_structure` | ✅ | Active |
| **T-019** | Analysis cache key includes geographic bounding box and significance threshold slugs, preventing cache poisoning across queries. | FACT | Verified in `backend/tests/test_application.py:test_cache_collision_prevention_on_bbox_and_alpha` | ✅ | Active |
| **T-020** | Git remote origin sanitized; credentials removed from local git configuration. | FACT | `git remote -v` inspected and verified 2026-10-05 | ✅ | Active |
| **A-001** | Offline demo fixtures bundled in `merra2.py` adapter satisfy judge demos with unmistakable synthetic data labeling and local NetCDF ingestion fallback. | FACT | Verified in `backend/tests/test_application.py:test_offline_demo_mode_data_provenance` | ✅ | Resolved |
| **A-002** | Monthly MERRA-2 data at 0.5°×0.625° resolution for 40 years fits comfortably in RAM for a single variable (~360 MB). | FACT | Benchmark calculation verified against NumPy memory allocator | ✅ | Resolved |

