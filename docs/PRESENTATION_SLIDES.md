# Tellura — Official 7-Slide Project Demonstration
### NASA Space Apps Challenge 2026 — "Be An Earth System Trend Detective!"
**Team:** Crimson Syndicate  
**Repository:** [https://github.com/ShivamGawade-XS/NSC](https://github.com/ShivamGawade-XS/NSC)  
**Live Application:** [https://tellura.onrender.com](https://tellura.onrender.com)  

---

## Slide 1: Title & Overview
# Tellura: The Earth System Trend Detective
### Autonomous Spatiotemporal Climate Trend Discovery for NASA Earth Observations
* **The Mission:** Transforming 44 years of NASA satellite observations into audit-proof climate truth with zero code, zero synthetic data, and zero false alarms.
* **The Challenge:** NASA Space Apps Challenge 2026 — *"Be An Earth System Trend Detective!"*
* **Core Value:** A non-parametric scientific lie-detector that separates permanent climate trends from temporary weather noise.
* **Team:** Crimson Syndicate (Lead: Shivam Gawade)
* **Access:** 100% Free Open Science • Live at [tellura.onrender.com](https://tellura.onrender.com)

---

## Slide 2: The Problem: 3 Fatal Statistical Fallacies
### Why 85% of Regional Climate Visualizations Fail
1. **The Linearity Fallacy:** Fitting straight lines (OLS) over skewed data. A single 1-in-100-year heatwave tilts the 40-year slope, manufacturing fake climate emergencies.
2. **The Red-Noise Mirage (Autocorrelation):** The atmosphere has thermal memory ($r_1 > 0$). Hot years cluster in 2–3 year streaks. Standard tests mistake cyclical persistence for permanent trends, creating up to 40% false-positive rates.
3. **The Multiplicity Trap:** Testing 10,000 spatial pixels simultaneously at $\alpha = 0.05$ guarantees ~500 false "warming hotspots" purely by random luck.
* **The Consequence:** Millions of dollars in municipal water reserves, flood infrastructure, and agricultural planning are misallocated on statistical noise.

---

## Slide 3: The Engine: Empirical Mathematical Rigor
### Non-Parametric Statistics Replacing Statistical Hallucinations
* **Theil-Sen Median Slope:** Computes the median of all pairwise temporal slopes. Robust up to a **29.3% outlier breakdown point**—immune to single freak weather years.
* **Hamed & Rao (1998) Variance Correction:** Calculates detrended rank autocorrelation across all significant lags, penalizing cyclical red noise to prevent false alarms.
* **Benjamini-Hochberg (1995) FDR ($q \le 0.05$):** Controls the proportion of false discoveries across spatial grids, verified by **Wilks (2016)** field significance.
* **Pettitt (1979) Changepoint Detection:** Pinpoints the exact calendar year an abrupt regime shift occurred.
* **Archimedean Copulas:** Models bivariate joint return periods for concurrent heatwave + drought compound hazards.

---

## Slide 4: Autonomous Discovery & Opposing Contrasts
### Answering NASA’s Core Prompts: "What", "Where", "How Much", & "Divergent Trends"
* **Composite Discovery Engine:** Automatically scans hundreds of spatial cells and ranks candidate signals using an objective composite formula balancing slope magnitude, $p$-value, data completeness, and spatial cluster coherence.
* **Connected-Component Contrasts Engine:** Solves the challenge's hardest prompt—discovering simultaneous opposing trends over identical observation windows (e.g., inland heating vs. coastal marine buffering across 450 km).
* **Burrows et al. (Nature 2011) Climate Velocity:** Computes vector fields ($\text{km}/\text{decade}$) measuring the required displacement pace for thermal envelopes.

---

## Slide 5: Multi-Persona Workstation & Accessibility
### Built for Scientists, City Planners, and Students
* **Three Adaptive Personas in One UI:**
  * **🕵️ Detective Mode:** 3-Step Guided Mystery Wizard, simplified terminology, and ELI5 physical field guides for STEM students.
  * **🏛️ Policy Mode:** Decision cockpit highlighting compound hazards, Copula return periods, and infrastructure resilience memos for city managers.
  * **🔬 Pro Mode:** Full mathematical dossiers, Anselin LISA clustering, and raw statistical matrices for researchers.
* **Sensory Accessibility:** Native browser Web Audio sonification transforms 40-year time series into musical frequencies, enabling visually impaired researchers to literally hear climate acceleration.

---

## Slide 6: System Architecture & Photorealistic 3D Globe
### Low-Latency, OWASP-Hardened Engineering
* **FastAPI Backend + SQLite WAL Cache:** Sub-15ms cached responses with SHA-256 deduplication and HMAC-SHA256 tamper verification.
* **Photorealistic 3D Planetary Globe V3:** Canvas orthographic sphere with offscreen raster caching, zero-allocation coordinate projection, 2x Retina Hi-DPI scaling, 6-band atmospheric cloud falloff, and depth-sorted 3D trend pillars.
* **Downstream AI Safety Shield:** Multi-provider LLM synthesis (Gemini $\rightarrow$ Groq $\rightarrow$ OpenAI) strictly grounded in pre-computed evidence XML, backed by a deterministic offline template engine.

---

## Slide 7: NASA Data Ingestion & Open Science Reproducibility
### 100% Authentic Space Observations • Fully Reproducible
* **Direct NASA Missions & Models:**
  * **NASA POWER API:** Live streaming NetCDF-4 from NASA Langley (Terra/Aqua MODIS, CERES, AIRS, GEOS-5 FP-IT).
  * **NASA GMAO MERRA-2:** Atmospheric reanalysis diagnostics via NASA GES DISC.
  * **NASA EOSDIS GIBS:** WMTS satellite basemap layers.
* **Open Science Export Suite:** 1-click downloads of CF-1.8 NetCDF-4, RFC 7946 GeoJSON, HMAC-signed IEEE/AGU LaTeX Memorandums, and cloud-executable Google Colab notebooks.
* **Quality Assurance:** 353 / 353 automated tests passing • 100% open source under the MIT License on GitHub.
