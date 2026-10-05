# EarthSift — Truth & Evidence Ledger

_Last updated: 2026-10-05_

This ledger records verified facts, tested assumptions, and engineering decisions.  
**Rule:** Only entries with a source citation are recorded. No entry from memory or inference without verification.

| ID | Statement | Type | Source / Evidence | Verified | Status |
| :--- | :--- | :---: | :--- | :---: | :---: |
| **T-001** | Challenge Title: *"Be An Earth System Trend Detective!"* | FACT | [NASA Space Apps 2026 page](https://www.spaceappschallenge.org/2026/challenges/be-an-earth-system-trend-detective/) — live HTML/JSON payload extracted 2026-10-05 | ✅ | Active |
| **T-002** | Challenge difficulty: Advanced. Skills: Earth Science, Software. | FACT | Same page JSON payload (`categories: [{name:"Advanced"}]`, `skills:["Earth Science","Software"]`) | ✅ | Active |
| **T-003** | MERRA-2 monthly land (`M2TMNXLND` v5.12.4) exists in NASA CMR catalog, archived at GESDISC. | FACT | CMR API query: `https://cmr.earthdata.nasa.gov/search/collections.json?short_name=M2TMNXLND&version=5.12.4` → entry returned 2026-10-05 | ✅ | Active |
| **T-004** | MERRA-2 monthly atmosphere (`M2TMNXSLV` v5.12.4) exists in NASA CMR catalog. | FACT | CMR API query: `?short_name=M2TMNXSLV&version=5.12.4` → entry returned 2026-10-05 | ✅ | Active |
| **T-005** | MODIS LST 8-day L3 1km (`MOD11A2` v061) exists in NASA CMR catalog, archived at LP DAAC. | FACT | CMR API query: `?short_name=MOD11A2&version=061` → entry returned 2026-10-05 | ✅ | Active |
| **T-006** | `earthaccess` v0.19.0 is on PyPI. Summary: "Client library for NASA Earthdata APIs". License field blank on PyPI but MIT on GitHub. | FACT | PyPI JSON API `https://pypi.org/pypi/earthaccess/json` queried 2026-10-05 | ✅ | Active |
| **T-007** | `pymannkendall` v1.4.3 is on PyPI. License: MIT. Summary: "A python package for non-parametric Mann-Kendall family of trend tests." | FACT | PyPI JSON API `https://pypi.org/pypi/pymannkendall/json` queried 2026-10-05 | ✅ | Active |
| **T-008** | `regionmask` v0.13.0 is on PyPI. License: MIT. Summary: "create masks of geospatial regions for arbitrary grids." | FACT | PyPI JSON API queried 2026-10-05 | ✅ | Active |
| **T-009** | `fastapi` v0.142.2 is on PyPI. License: MIT (field blank; MIT confirmed at github.com/fastapi/fastapi). | FACT | PyPI JSON API queried 2026-10-05 | ✅ | Active |
| **T-010** | Environmental time series are frequently non-normal; Mann-Kendall + Sen's Slope is the accepted non-parametric standard in climate science. | FACT | Hirsch et al. (1982) *Technometrics*; Gilbert (1987) *Statistical Methods for Environmental Pollution Monitoring* | Literature | Active |
| **T-011** | Multiple simultaneous grid-cell trend tests inflate false positives without correction; Benjamini-Hochberg FDR controls this at q = 0.10. | FACT | Benjamini & Hochberg (1995) *J. Royal Statistical Society* | Literature | Active |
| **T-012** | Prototype backend passes 13/13 unit + integration tests covering Mann-Kendall, Sen's Slope, BH-FDR, API endpoints `/health`, `/api/v1/datasets`, `/api/v1/analysis`, `/api/v1/analysis/{id}/cell`, `/api/v1/explain`. | FACT | `pytest backend/tests/ -v` output — commit `f97e092` on 2026-10-05 | ✅ | Active |
| **T-013** | Challenge "Resources" tab content was empty as of 2026-10-05 inspection. | OBSERVATION | Live page JSON: `resourcesTabContent: ""` | ✅ | Active |
| **A-001** | Offline demo fixtures bundled in `merra2.py` adapter will satisfy judge demos without requiring a live Earthdata token. | ASSUMPTION | Engineering decision; not independently verified yet | — | Watch |
| **A-002** | Monthly MERRA-2 data at 0.5°×0.625° resolution for 40 years fits comfortably in RAM for a single variable. | ASSUMPTION | ~40 yrs × 12 months × 361×576 grid × 4 bytes ≈ ~360 MB per variable — reasonable for a development machine | Estimate | Watch |
