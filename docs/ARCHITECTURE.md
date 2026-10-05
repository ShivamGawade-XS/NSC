# EarthSift — System Architecture & Design

## 1. Challenge Overview
* **Event:** NASA Space Apps Challenge 2026
* **Challenge:** *Be An Earth System Trend Detective!*
* **Official URL:** [NASA Space Apps Challenge 2026](https://www.spaceappschallenge.org/2026/challenges/be-an-earth-system-trend-detective/)
* **Core Mandate:**
  > *"Find and examine variables measured by NASA missions or produced by NASA models, visualize how they change over time, and determine what is changing, where it is changing, how much it is changing, and if these changes are what scientists call 'significant.'"*

---

## 2. Product Mission & Philosophy

EarthSift is an evidence-first Earth-system trend discovery platform.

> **"The scientific engine is the product. The map is the instrument. AI is an interpreter, not the calculator."**

### Core Investigation Inquiries
For any analyzed variable, EarthSift deterministically answers:
1. **What variable** is being analyzed?
2. **Where** is it changing spatially?
3. **What direction** is the change moving (increasing, decreasing)?
4. **How large** is the estimated trend (in physical units per time period)?
5. **Over what time horizon** was it measured?
6. **How much valid data** supports the analysis (sample completeness)?
7. **Is the trend statistically significant** under robust statistical tests?
8. **What does the result NOT establish?** (Limitations, avoiding causal overclaiming)

---

## 3. End-to-End Processing Pipeline

```text
                  NASA / Earthdata
                         │
                         ▼
                  Dataset Adapter
                         │
                         ▼
               Metadata + Validation
                         │
                         ▼
                  Subset Selection
                         │
                         ▼
               Preprocessing / Units
                         │
                         ▼
              Temporal Normalization
                         │
                         ▼
                    Trend Engine
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
           Magnitude             Significance
          (Sen Slope)          (Mann-Kendall)
              │                     │
              └──────────┬──────────┘
                         ▼
              Multiple-Test Control (FDR)
                         │
                         ▼
                 Spatial Discovery
                         │
               ┌─────────┴─────────┐
               ▼                   ▼
            Signals            Contrasts
          (Clusters)       (Opposing Trends)
               │                   │
               └─────────┬─────────┘
                         ▼
                   Evidence Layer
                         │
               ┌─────────┴─────────┐
               ▼                   ▼
             Web UI           AI Explainer
         (Interactive)     (Downstream Summary)
```

---

## 4. Architectural Components

### 4.1 Data Ingestion & Adapter Layer (`/backend/adapters`)
* **`DataProvider` Interface:** Abstracts raw data access (NASA CMR / Earthdata / local reanalysis cache).
* **`DatasetAdapter`:**
  - `discover()`: Enumerate collections and available temporal ranges.
  - `metadata()`: Fetch dimensional info, native resolution, units, and coordinate grids.
  - `validate()`: Ensure temporal bounds and bounding boxes fall within valid data bounds.
  - `fetch()`: Retrieve the required slice.
  - `subset()`: Geographic and temporal windowing via `xarray`.
  - `normalize()`: Standardize calendar timestamps, missing value masks, and unit scaling.

### 4.2 Scientific Analysis Engine (`/backend/science`)
* **Trend Estimation:** Non-parametric **Sen's Slope (Theil-Sen)** provides a median-of-slopes estimate resistant to outliers.
* **Significance Testing:** **Mann-Kendall test** calculates the Kendall $\tau$ and asymptotic p-value without assuming normal distribution.
* **Multiple-Testing Adjustment:** Spatial grids test thousands of pixels simultaneously; applying **Benjamini-Hochberg (FDR)** guards against false positives ($p < 0.05$ threshold inflation).
* **Spatial Discovery:** Connected-component spatial analysis aggregates adjacent significant grid cells into coherent geographic signal clusters.
* **Contrasting Regions Finder:** Identifies dual regions demonstrating statistically significant trends in opposite directions during the same temporal window.

### 4.3 Evidence Layer (`/backend/evidence`)
Generates structured JSON records detailing:
* Physical slope & units (e.g., $+0.42\ ^\circ\text{C} / \text{decade}$)
* Significance metrics ($p$-value, adjusted $q$-value, test statistic)
* Data completeness (sample counts, missing percentage)
* Methodological parameters and limitations
* Full source provenance (collection ID, DOI, timestamp)

### 4.4 Web Application (`/frontend`)
* **Analysis Controls:** Dataset, variable, time range, bounding box, and statistical parameters.
* **Interactive Trend Map:** MapLibre GL rendering spatial trend directions, magnitudes, and significance masks.
* **Time-Series Charting:** Temporal plots with fitted Sen slope, confidence intervals, and raw data points.
* **Evidence Panel:** Scientific transparency inspector displaying observation stats, limitations, and data provenance.
* **Downstream AI Explainer:** Optional natural-language summarizer conditioned strictly on the deterministic evidence object.

---

## 5. UI Workspace Layout

```text
┌─────────────────┬───────────────────────────────────────────┬──────────────────────┐
│                 │                                           │                      │
│ ANALYSIS        │                 TREND MAP                 │ EVIDENCE             │
│ CONTROLS        │                                           │ PANEL                │
│                 │                                           │                      │
│ • Dataset       │   - Spatial Heatmap / Vector Glyphs       │ • Observation        │
│ • Variable      │   - Significance Stippling / Masking      │ • Magnitude & Units  │
│ • Time Period   │   - Interactive Point & Region Selection  │ • P-value / Q-value  │
│ • Region (AOI)  │   - Signal Discovery Highlights           │ • Data Completeness  │
│ • Run Analysis  │                                           │ • Provenance & DOI   │
│                 │                                           │ • Caveats / Limits   │
├─────────────────┴───────────────────────────────────────────┴──────────────────────┤
│                                TIME SERIES INSPECTOR                               │
│      - Historical Observations  - Sen Slope Trendline  - Anomaly Baseline          │
└────────────────────────────────────────────────────────────────────────────────────┘
```
