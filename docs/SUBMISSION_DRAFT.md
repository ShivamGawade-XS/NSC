# EarthSift — NASA Space Apps 2026 Submission Document

**Project Title:** EarthSift  
**Challenge:** Be An Earth System Trend Detective!  
**Tagline:** *Find the changes worth investigating.*  
**Repository:** [https://github.com/ShivamGawade-XS/NSC](https://github.com/ShivamGawade-XS/NSC)  
**Team Contact:** `nsc26cs@gmail.com`  
**Test Suite:** 337 / 337 automated tests passing (100%)  

---

## 1. High-Level Summary
Change is pervasive across the Earth system. Yet when researchers test thousands of satellite and reanalysis grid cells simultaneously across multi-decadal timelines, conventional statistical tools encounter three fatal pitfalls: the linearity fallacy (spurious OLS regression lines over skewed data), the red-noise mirage (unadjusted serial autocorrelation manufacturing artificial significance), and the multiplicity trap (false discoveries from testing tens of thousands of spatial pixels without error-rate control).

**EarthSift** is an evidence-first, mathematically immutable spatiotemporal workstation engineered specifically for the NASA Space Apps Challenge (*"Be An Earth System Trend Detective!"*). Powered by live NASA Earth observations (NASA POWER ASDC & GMAO MERRA-2), EarthSift pairs vectorized non-parametric Mann-Kendall trend tests, Hamed & Rao (1998) serial autocorrelation corrections, Sen's robust median slopes, Gilbert (1987) confidence intervals, and Benjamini-Hochberg False Discovery Rate (FDR) multiplicity control ($q \le 0.05$) into a blazing-fast, verifiable scientific instrument.

Beyond raw trend rates, EarthSift delivers advanced physical attribution:
- **Pettitt (1979) Regime Shift Detection**: Pinpoints exact non-parametric change-point years in multi-decadal series.
- **Burrows et al. (Nature 2011) Climate Velocity**: Computes vector fields ($\text{km}/\text{decade}$) measuring the required spatial displacement pace for thermal envelopes.
- **Archimedean Copulas**: Models joint bivariate return periods for compound climate hazards (e.g., heatwaves coupled with agricultural drought).
- **Stott et al. (Nature 2004) & Otto et al. (2020) FAR Engine**: Calculates the Fraction of Attributable Risk and Risk Ratio for anthropogenic acceleration.
- **Cascading Multi-LLM Copilot**: Combines Google Gemini, Groq Cloud / xAI Grok, and OpenAI with strict XML evidence grounding and a guaranteed deterministic scientific fallback engine.

---

## 2. How It Addresses the Challenge
The NASA 2026 challenge *"Be An Earth System Trend Detective!"* asks teams to examine variables measured by NASA missions or produced by NASA models, visualize how they change over time, and determine:
- **What is changing?** Multi-decadal atmospheric and surface variables: 2-meter air temperature (`T2M`), precipitation rate (`PRECTOT`), all-sky surface solar radiation (`ALLSKY_SFC_SW_DWN`), 10-meter wind speed (`WS10M`), and 2-meter relative humidity (`RH2M`).
- **Where is it changing?** Interactive 2D Leaflet Canvas grid inspection coupled with a 3D Canvas orthographic planetary globe (`PlanetaryGlobe3D.jsx`).
- **How much is it changing?** Sen’s robust median-of-slopes rates reported in standardized physical units per decade (°C/decade, mm/day/decade, $\text{W}/\text{m}^2/\text{decade}$), immune to extreme weather outliers up to a 29% breakdown point.
- **Is it statistically significant?** Two-tailed Mann-Kendall with Hamed-Rao serial persistence adjustments and Benjamini-Hochberg FDR multiplicity control ($q \le 0.05$).
- **Opposing & Contrasting Trends:** Dedicated "Find Contrasts" engine isolating simultaneous opposing trends (e.g. continental warming contrasted with subpolar cooling) within the identical time window.
- **Physical Plausibility & Attribution:** Grounded physical hypotheses with peer-reviewed literature DOIs and Stott-Otto anthropogenic attribution factors.

---

## 3. NASA Data & Open Science Assets Used
- **NASA Langley ASDC POWER API:**
  - Daily & monthly CERES / MERRA-2 surface solar irradiance, temperature, humidity, and wind datasets.
  - Endpoint: `https://power.larc.nasa.gov/api/temporal/monthly/regional`
- **NASA GMAO MERRA-2 Atmospheric Reanalysis:**
  - `M2TMNXSLV` (Monthly 2D Atmospheric Diagnostics)
  - `M2TMNXFLX` (Monthly 2D Surface Flux Diagnostics)
  - DOI: [10.5067/A7F0JNNUTWOB](https://doi.org/10.5067/A7F0JNNUTWOB)
- **NASA EOSDIS CMR (Common Metadata Repository):**
  - Live granule querying via `earthaccess`.
- **NASA GIBS (Global Imagery Browse Services):**
  - WMTS raster layers (EPSG:3857) for base cartographic context.

---

## 4. Technical Architecture
- **Backend:** Python 3.12+, FastAPI, Uvicorn, NumPy 2, SciPy, xarray, NetCDF4, SQLite (WAL mode with HMAC-SHA256 cache signing), SlowAPI rate limiting, Prometheus metrics.
- **Frontend:** React 19, Vite 8, Tailwind CSS v4, Zustand 5, Leaflet 1.9.4 Canvas, Chart.js 4.5.1, Framer Motion, Web Worker statistical offloading (`calcWorker.js`), Web Audio API sonification.
- **Verification:** 337 / 337 automated tests passing in 71 seconds across mathematical units, security hardening, cache concurrency, and API contracts. Oxlint 0 warnings / 0 errors across 43 frontend modules.
- **Export Standards:** CF-1.8 NetCDF-4 binary, RFC 7946 GeoJSON, executable Google Colab / Jupyter notebooks (`.ipynb`), AGU Preprint PDF, Overleaf LaTeX specification.

---

## 5. Potential Impact
EarthSift delivers an uncompromisingly rigorous, inspectable instrument for climate scientists, environmental journalists, educators, and the public. By replacing statistical hallucinations with verifiable non-parametric mathematics, EarthSift ensures that every detected trend is real, statistically sound, and physically grounded.
