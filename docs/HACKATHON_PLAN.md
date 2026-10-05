# EarthSift — Hackathon Execution Plan & Pitch Narrative

## 1. Hackathon Execution Phases

### Phase 1: Ingestion & Adapter Foundation
* Build the NASA dataset adapter with local caching.
* Verify coordinate alignment, variable units, and time axis regularity.
* Implement sample dataset fixture for offline demo resiliency.

### Phase 2: Scientific Trend Engine
* Implement vectorized Mann-Kendall and Sen's slope calculations.
* Implement Benjamini-Hochberg FDR correction.
* Unit-test against synthetic signals with known ground-truth slopes.

### Phase 3: Vertical Slice & API
* Wire FastAPI backend to serve analysis endpoints, GeoJSON trend grids, and coordinate time series.
* Verify response performance and sub-second caching.

### Phase 4: Frontend Workspace & Interactive Map
* Build MapLibre GL spatial map with diverging trend color ramp and significance layers.
* Integrate ECharts time series view and scientific evidence panel.
* Add "Find Contrasts" feature to highlight opposing regional trends.

### Phase 5: Hardening & Submission
* Verify reproducibility from clean checkout.
* Record demo walkthrough video.
* Polish README and NASA Space Apps submission page.

---

## 2. Pitch Presentation Structure (7 Slides)

1. **Title:** EarthSift — *Find the changes worth investigating.*
2. **The Problem:** Earth-system data contains vast temporal changes, but distinguishing authentic, statistically significant trends from random noise or seasonal cycles is daunting.
3. **The Solution:** An evidence-first investigation platform that computes robust non-parametric trends and discovers contrasting regional behaviors.
4. **The Science:** Mann-Kendall monotonic trend testing + Sen's robust slope + False Discovery Rate (FDR) multiplicity control.
5. **Live Demonstration:** Interactive map exploration, cell time-series drilldown, and opposing trend discovery.
6. **Key Differentiator:** Transparent provenance, explicit scientific caveats, and deterministic evidence generation rather than black-box AI guessing.
7. **Impact:** Accelerates Earth science investigation for researchers, students, and environmental decision-makers.
