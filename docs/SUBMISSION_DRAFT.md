# EarthSift — NASA Space Apps 2026 Submission Draft

**Project Title:** EarthSift  
**Challenge:** Be An Earth System Trend Detective!  
**Tagline:** Find the changes worth investigating.  
**Repository:** [https://github.com/ShivamGawade-XS/NSC](https://github.com/ShivamGawade-XS/NSC)  

---

## 1. High-Level Summary
Change is constant across the Earth system. But when scientists test thousands of satellite and model grid cells across decades, classical statistics fall into two major traps: multiple-testing false positives and serial autocorrelation distortion. 

**EarthSift** is an evidence-first Earth system trend discovery platform. Built on NASA MERRA-2 atmospheric reanalysis data, it couples non-parametric Mann-Kendall trend testing, Hamed & Rao (1998) serial autocorrelation correction, Sen’s robust slope estimation, and Benjamini-Hochberg False Discovery Rate (FDR) multiplicity control into a lightning-fast, inspectable scientific instrument. EarthSift features an automated **Discovery Engine** that surfaces candidate signals with transparent composite scoring and a **Contrast Engine** that isolates simultaneous, opposing regional trends (such as continental warming contrasted with subpolar cooling).

---

## 2. How It Addresses the Challenge
The NASA 2026 challenge *"Be An Earth System Trend Detective!"* asks teams to examine variables measured by NASA missions or produced by NASA models, visualize how they change over time, and determine:
- **What is changing?** Multi-decadal atmospheric variables (2-meter air temperature `T2M` and precipitation rate `PRECTOT`).
- **Where is it changing?** High-resolution spatial grids with interactive cartographic drilldown.
- **How much is it changing?** Sen’s robust median-of-slopes rates reported in physical units per decade (°C/decade and mm/day/decade), resistant to extreme weather outliers.
- **Is it statistically significant?** Evaluated via two-tailed Mann-Kendall with Hamed-Rao serial autocorrelation adjustment and Benjamini-Hochberg FDR multiplicity control ($q \le 0.05$).
- **Opposing trends:** Explicitly discovers contrasting regions where the same temporal window exhibits opposing validated trends without speculating on unproven causal links.

---

## 3. NASA Data & Open Science Assets Used
- **NASA GMAO MERRA-2 Atmospheric Reanalysis:**
  - `M2TMNXSLV` (Monthly 2D Atmospheric Diagnostics)
  - `M2TMNXFLX` (Monthly 2D Surface Flux Diagnostics)
  - DOI: [10.5067/A7F0JNNUTWOB](https://doi.org/10.5067/A7F0JNNUTWOB)
- **NASA Common Metadata Repository (CMR) & `earthaccess`:** Integration for live granule discovery and Earthdata streaming.

---

## 4. Technical Architecture
- **Backend:** Python 3.13 / 3.14, FastAPI, NumPy, SciPy, Pydantic, Uvicorn.
- **Frontend:** Zero-build semantic HTML5, Vanilla CSS3 (custom mission-control scientific design system), Leaflet.js cartography, Chart.js time series plots.
- **Testing:** 36 automated tests covering unit math, edge cases, application resilience, and API contracts (100% passing).
- **AI Safety:** Downstream explainer operating strictly on structured evidence objects with deterministic offline fallback text.

---

## 5. Potential Impact
EarthSift provides climate researchers, science journalists, educators, and citizens with a trustworthy lens into Earth system observations. By eliminating statistical hallucinations and controlling false discovery rates, it ensures that when EarthSift surfaces a trend, it is genuinely worth investigating.
