# EarthSift — Comprehensive Variable Metadata Reference
## Atmospheric & Earth System Observation Catalog Specifications

**Project:** EarthSift — Autonomous Spatial Trend Discovery Instrument  
**Competition:** NASA Space Apps Challenge 2026 — *"Be An Earth System Trend Detective!"*  
**Document:** `NASA_CHALLENGE_VARIABLE_METADATA_REFERENCE.md`  
**Execution Timestamp:** 2026-10-24 13:53:00 UTC+05:30  
**Compliance Standard:** NASA Earth Science Data and Information System (ESDIS) & WMO-No. 1203  

---

## 1. Overview & Architectural Principles

EarthSift ingests multi-decadal Earth observation data from two NASA data systems:
1. **NASA POWER (Prediction of Worldwide Energy Resources)** — Regional API endpoint `https://power.larc.nasa.gov/api/temporal/monthly/regional`
2. **NASA MERRA-2 (Modern-Era Retrospective analysis for Research and Applications, Version 2)** — NASA GMAO GEOS-5 Atmospheric Data Assimilation System via NASA CMR

To preserve absolute scientific integrity and avoid spurious trend discovery, this reference defines:
- The exact native spatial resolution of each variable.
- The metric ground distance scaling relation as a function of latitude.
- The temporal aggregation level utilized in statistical regressions.
- The underlying satellite missions, radiometers, sounders, and assimilation models.
- Operational boundaries and sensor discontinuity constraints.

---

## 2. Spatial Grid Resolution & Metric Distance Scaling

Geographic grids defined by constant angular increments ($\Delta\lambda$ in longitude, $\Delta\phi$ in latitude) represent variable metric surface distances depending on latitude $\phi$:

$$\Delta y = R \cdot \Delta\phi \cdot \frac{\pi}{180} \approx 111.13 \text{ km per degree latitude}$$
$$\Delta x(\phi) = R \cdot \cos(\phi) \cdot \Delta\lambda \cdot \frac{\pi}{180} \approx 111.13 \cdot \cos(\phi) \cdot \Delta\lambda \text{ km per degree longitude}$$

*(where $R \approx 6,371\text{ km}$ is Earth's volumetric mean radius)*

### Ground Distance Table by Latitude

| Latitude ($\phi$) | $\Delta y$ ($0.5^\circ$ Lat) | $\Delta x$ ($0.5^\circ$ Lon, POWER) | $\Delta x$ ($0.625^\circ$ Lon, MERRA-2) | $\Delta x$ ($1.0^\circ$ Lon, CERES) |
| :--- | :--- | :--- | :--- | :--- |
| **$0^\circ$ (Equator)** | $55.56\text{ km}$ | $55.56\text{ km}$ | $69.46\text{ km}$ | $111.13\text{ km}$ |
| **$30^\circ\text{N/S}$** | $55.56\text{ km}$ | $48.12\text{ km}$ | $60.15\text{ km}$ | $96.24\text{ km}$ |
| **$45^\circ\text{N/S}$** | $55.56\text{ km}$ | $39.29\text{ km}$ | $49.11\text{ km}$ | $78.58\text{ km}$ |
| **$60^\circ\text{N/S}$** | $55.56\text{ km}$ | $27.78\text{ km}$ | $34.73\text{ km}$ | $55.56\text{ km}$ |
| **$75^\circ\text{N/S}$** | $55.56\text{ km}$ | $14.38\text{ km}$ | $17.98\text{ km}$ | $28.76\text{ km}$ |

---

## 3. NASA POWER Variable Catalog

All NASA POWER monthly queries retrieve 13 timestamps per calendar year:
- `YYYY01` through `YYYY12`: Raw monthly means.
- `YYYY13`: Pre-calculated **annual mean** for that calendar year.
- **EarthSift Aggregation Level:** EarthSift isolates `YYYY13` slices to perform non-parametric monotonic trend fitting on **annual means**, avoiding seasonal autocorrelation distortions.

### Ingested Variables:

#### 1. `T2M` — 2-Meter Air Temperature
- **NASA Parameter ID:** `T2M`
- **Product Type:** `reanalysis_assimilation`
- **Native Spatial Resolution:** $0.5^\circ \text{ latitude} \times 0.625^\circ \text{ longitude}$ (re-gridded to $0.5^\circ \times 0.5^\circ$)
- **Temporal Aggregation:** `annual_mean` (derived from `YYYY13`)
- **Temporal Range:** 1981–present
- **Source Units:** $^\circ\text{C}$ | **Display Units:** $^\circ\text{C}$ | **Slope Units:** $^\circ\text{C} / \text{decade}$
- **Mission Source:** NASA GMAO GEOS-5 FP-IT assimilation model informed by Terra/Aqua sounders and CERES
- **Discontinuity Warning:** None (continuous assimilated atmospheric reanalysis)

#### 2. `PRECTOT` / `PRECTOTCORR` — Total Corrected Precipitation
- **NASA Parameter ID:** `PRECTOTCORR`
- **Product Type:** `satellite_gauge_assimilated`
- **Native Spatial Resolution:** $0.1^\circ / 0.5^\circ$ satellite-gauge assimilation
- **Temporal Aggregation:** `annual_mean` (derived from `YYYY13`)
- **Temporal Range:** 1981–present
- **Source Units:** $\text{mm / day}$ | **Display Units:** $\text{mm / day}$ | **Slope Units:** $\text{mm / day / decade}$
- **Mission Source:** TRMM and GPM satellite constellation combined with GEOS-5 FP-IT gauge-corrected precipitation analysis
- **Discontinuity Warning:** None

#### 3. `ALLSKY_SFC_SW_DWN` — All Sky Surface Shortwave Downward Irradiance
- **NASA Parameter ID:** `ALLSKY_SFC_SW_DWN`
- **Product Type:** `satellite_retrieval_and_model_composite`
- **Native Spatial Resolution:** $1.0^\circ \text{ latitude} \times 1.0^\circ \text{ longitude}$ (CERES SYN1deg re-gridded to $0.5^\circ$)
- **Temporal Aggregation:** `annual_mean` (derived from `YYYY13`)
- **Temporal Range:** 1984–present
- **Source Units:** $\text{MJ/m}^2/\text{day}$ | **Display Units:** $\text{MJ/m}^2/\text{day}$ | **Slope Units:** $\text{MJ/m}^2/\text{day / decade}$
- **Mission Source:**
  - 1984–2000: GEWEX Surface Radiation Budget (SRB) Release 3
  - 2001–present: Terra/Aqua Clouds and the Earth's Radiant Energy System (CERES SYN1deg)
- **Discontinuity Notice & Operational Boundary:**
  > **MANDATORY SCIENTIFIC CONSTRAINT:**  
  > The 2000/2001 instrument transition contains unharmonized sensor calibration step-offsets.  
  > EarthSift **strictly forbids** single continuous monotonic trend estimation crossing the 2000/2001 boundary. Queries attempting to span pre-2001 and post-2001 regimes are intercepted and rejected with **HTTP 422**. Users must select either the pre-2001 or post-2001 regime.

#### 4. `WS10M` — 10-Meter Wind Speed
- **NASA Parameter ID:** `WS10M`
- **Product Type:** `reanalysis_assimilation`
- **Native Spatial Resolution:** $0.5^\circ \text{ latitude} \times 0.625^\circ \text{ longitude}$ (re-gridded to $0.5^\circ \times 0.5^\circ$)
- **Temporal Aggregation:** `annual_mean` (derived from `YYYY13`)
- **Temporal Range:** 1981–present
- **Source Units:** $\text{m/s}$ | **Display Units:** $\text{m/s}$ | **Slope Units:** $\text{m/s / decade}$
- **Mission Source:** NASA GMAO GEOS-5 FP-IT atmospheric assimilation system
- **Discontinuity Warning:** None

#### 5. `RH2M` — 2-Meter Relative Humidity
- **NASA Parameter ID:** `RH2M`
- **Product Type:** `reanalysis_assimilation`
- **Native Spatial Resolution:** $0.5^\circ \text{ latitude} \times 0.625^\circ \text{ longitude}$ (re-gridded to $0.5^\circ \times 0.5^\circ$)
- **Temporal Aggregation:** `annual_mean` (derived from `YYYY13`)
- **Temporal Range:** 1981–present
- **Source Units:** $\%$ | **Display Units:** $\%$ | **Slope Units:** $\% / \text{decade}$
- **Mission Source:** NASA GMAO GEOS-5 FP-IT atmospheric assimilation system
- **Discontinuity Warning:** None

---

## 4. NASA MERRA-2 Reanalysis Variable Catalog

NASA MERRA-2 provides global atmospheric reanalysis produced by the NASA Global Modeling and Assimilation Office (GMAO) using the GEOS-5 Atmospheric Data Assimilation System.

- **DOI:** `10.5067/A7F0JNNUTWOB`
- **Global Native Grid:** $0.5^\circ \text{ latitude} \times 0.625^\circ \text{ longitude}$ ($576 \times 361$ global grid points)
- **Temporal Range:** 1980–2024
- **Temporal Aggregation:** `annual_mean`

### Ingested Variables:

#### 1. `T2M` — 2-Meter Air Temperature
- **CMR Short Name:** `M2TMNXSLV` (2D monthly mean surface meteorology)
- **Native Spatial Resolution:** $0.5^\circ \text{ latitude} \times 0.625^\circ \text{ longitude}$
- **Source Units:** $\text{K}$ (converted to $^\circ\text{C}$ in memory via $T_{^\circ\text{C}} = T_{\text{K}} - 273.15$)
- **Display Units:** $^\circ\text{C}$ | **Slope Units:** $^\circ\text{C} / \text{decade}$
- **Mission Source:** NASA GMAO GEOS-5 ADAS assimilating Terra/Aqua AIRS, AMSU-A, and satellite radiance observations

#### 2. `PRECTOT` — Total Precipitation Rate
- **CMR Short Name:** `M2TMNXFLX` (2D monthly mean surface fluxes)
- **Native Spatial Resolution:** $0.5^\circ \text{ latitude} \times 0.625^\circ \text{ longitude}$
- **Source Units:** $\text{kg m}^{-2} \text{s}^{-1}$ (converted to $\text{mm / day}$ via $\times 86400$)
- **Display Units:** $\text{mm / day}$ | **Slope Units:** $\text{mm / day / decade}$
- **Mission Source:** NASA GMAO GEOS-5 atmospheric general circulation model driven by satellite microwave imagers and corrected with CPC gauge data

---

## 5. Climatological Duration vs. Standard Normal Definitions

In strict conformance with **WMO-No. 1203** (*WMO Guidelines on the Calculation of Climate Normals*):

1. **WMO Climatological Standard Normal:**
   A 30-year average baseline $\bar{X} = \frac{1}{30}\sum_{y=1}^{30} X_y$ over a defined historical period (e.g. 1991–2020). It is a **scalar central tendency**, not a trend.
2. **Multi-Decadal Climate Signal Duration Threshold:**
   An observation period $\ge 20$ years recommended by climate researchers and IPCC assessments to differentiate anthropogenic or multi-decadal trends from interannual ocean-atmospheric modes (ENSO, NAO, PDO).
3. **EarthSift Representation:**
   EarthSift exposes the boolean field `meets_climatological_duration_threshold = (end_year - start_year + 1 >= 20)`. EarthSift produces non-parametric **Theil-Sen monotonic regression slopes ($dX/dt$)**, and explicitly clarifies in metadata and dossiers that trend slopes must not be confused with WMO 30-year baseline normals.
