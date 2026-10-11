# EarthSift: Spatiotemporal Climate Trend Discovery System

[![NASA Space Apps Challenge 2026](https://img.shields.io/badge/NASA%20Space%20Apps-2026-0B3D91?style=for-the-badge&logo=nasa)](https://www.spaceappschallenge.org/2026/challenges/be-an-earth-system-trend-detective/)
[![Tests: 86 Passing](https://img.shields.io/badge/Tests-86%20Passing%20(100%25)-success?style=for-the-badge)](backend/tests/)
[![Conventions: CF--1.8](https://img.shields.io/badge/Conventions-CF--1.8%20NetCDF--4-blue?style=for-the-badge)](https://cfconventions.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-gray?style=for-the-badge)](LICENSE)

---

## 1. Abstract & System Overview

EarthSift is a high-performance spatiotemporal analytics workstation designed for empirical detection, spatial clustering, and physical attribution of multi-decadal trends across NASA Earth observation records. Developed in response to the NASA Space Apps Challenge (*Be An Earth System Trend Detective!*), the system bypasses standard linear assumptions by deploying non-parametric estimators that remain robust in the presence of sensor drift, non-Gaussian noise, extreme meteorological anomalies, and red noise serial autocorrelation.

The architecture decouples heavy numerical computing from interactive cartographic visualization:
- **Scientific Computing Kernel**: Python 3.12+ backend running optimized NumPy/SciPy vectorized arrays for parallel pixel-wise hypothesis testing.
- **Geospatial Presentation Layer**: React 19 + Leaflet GIS workstation rendered in a low-latency, high-density dark mode configured to NASA Jet Propulsion Laboratory (JPL) operational standards.
- **Physical Attribution Engine**: Grounded, deterministic mechanism briefings tied strictly to verified empirical evidence records and peer-reviewed literature.

```
NASA Earth Observations (MERRA-2 GMAO / POWER LaRC)
         │
         ▼
Two-Tier Cache Boundary (L1 Memory LRU ⇄ L2 SQLite B-Tree)
         │
         ▼
Vectorized Non-Parametric Engine (Mann-Kendall + Hamed-Rao Variance Correction)
         │
         ▼
Theil-Sen Median Slope Estimator & Gilbert (1987) 95% CI Bounds
         │
         ▼
Multiplicity Control via Benjamini-Hochberg False Discovery Rate (q ≤ 0.05)
         │
         ▼
Spatial Autocorrelation Regimes (Anselin LISA Local Moran's I)
         │
         ▼
Climate Velocity Vector Field (Burrows et al., Nature 2011)
         │
         ▼
Deterministic Export Pipeline (CF-1.8 NetCDF-4, GeoJSON, Executable .ipynb, LaTeX)
```

---

## 2. Mathematical & Spatiotemporal Methodology

### 2.1 Non-Parametric Monotonic Trend Estimation (Mann-Kendall)
For an ordered time series $y = \{y_1, y_2, \dots, y_n\}$, the Mann-Kendall statistic $S$ sums the directional signs of all pairwise temporal steps:

$$S = \sum_{i=1}^{n-1} \sum_{j=i+1}^{n} \text{sgn}(y_j - y_i)$$

$$\text{sgn}(\theta) = \begin{cases} +1 & \text{if } \theta > 0 \\ 0 & \text{if } \theta = 0 \\ -1 & \text{if } \theta < 0 \end{cases}$$

Under null conditions of independent and identically distributed observations with tied values grouped into sizes $t_k$:

$$\text{Var}(S) = \frac{1}{18} \left[ n(n-1)(2n+5) - \sum_{k} t_k(t_k - 1)(2t_k + 5) \right]$$

### 2.2 Serial Autocorrelation Correction (Hamed & Rao, 1998)
To prevent persistent climate inertia (red noise) from inflating Type-I error rates, the variance of $S$ is adjusted on detrended rank residuals:

$$\text{Var}^*(S) = \text{Var}(S) \cdot \left[ 1 + \frac{2}{n(n-1)(n-2)} \sum_{k=1}^{n-1} (n-k)(n-k-1)(n-k-2) \rho^*_k \right]$$

where $\rho^*_k$ is the lag-$k$ autocorrelation coefficient of the detrended rank series evaluated only when statistically significant at the 95% confidence level ($|\rho^*_k| > 1.96 / \sqrt{n}$).

The normalized test statistic $Z$ yields the two-tailed probability $p$:

$$Z = \begin{cases} \frac{S - 1}{\sqrt{\text{Var}^*(S)}} & \text{if } S > 0 \\ 0 & \text{if } S = 0 \\ \frac{S + 1}{\sqrt{\text{Var}^*(S)}} & \text{if } S < 0 \end{cases}, \quad p = 2 \left( 1 - \Phi(|Z|) \right)$$

### 2.3 Theil-Sen Robust Slope & Gilbert (1987) Confidence Interval
The decadal trend magnitude $\beta$ is computed as the median of all pairwise temporal increments:

$$\beta = \text{median} \left( \frac{y_j - y_i}{t_j - t_i} \right) \quad \forall \; j > i$$

Non-parametric 95% confidence intervals $[M_1, M_2]$ are defined over sorted pairwise slopes using the rank indices:

$$M_1 = \frac{N' - Z_{1-\alpha/2} \sqrt{\text{Var}^*(S)}}{2}, \quad M_2 = \frac{N' + Z_{1-\alpha/2} \sqrt{\text{Var}^*(S)}}{2} + 1$$

where $N' = \frac{n(n-1)}{2}$.

### 2.4 Multiplicity Control (Benjamini-Hochberg False Discovery Rate)
Across $M$ simultaneous pixel hypothesis evaluations, the $p$-values are ordered ascendingly $p_{(1)} \le p_{(2)} \le \dots \le p_{(M)}$ to enforce False Discovery Rate control at $q \le \alpha$:

$$k = \max \left\{ i : p_{(i)} \le \frac{i}{M} \alpha \right\}$$

Grid cells satisfying $p_{(i)} \le p_{(k)}$ reject the null hypothesis while constraining expected false discoveries to under 5%.

### 2.5 Spatial Autocorrelation Regimes (Anselin Local Moran's I)
To identify coherent spatial warming clusters versus localized outliers, Queen-contiguity spatial weight matrices $W$ ($w_{ij} = 1$ for adjacent neighbors) are computed for standardized trend deviations $z_i = \beta_i - \bar{\beta}$:

$$I_i = \frac{z_i}{s^2} \sum_{j=1}^{N} w_{ij} z_j, \quad s^2 = \frac{1}{N} \sum_{i=1}^{N} z_i^2$$

- **High-High (Hotspots)**: $z_i > 0$ and $\sum_j w_{ij} z_j > 0$ ($p \le 0.05$).
- **Low-Low (Refugia)**: $z_i < 0$ and $\sum_j w_{ij} z_j < 0$ ($p \le 0.05$).
- **Spatial Outliers**: High-Low ($z_i > 0, \sum w_{ij} z_j < 0$) and Low-High ($z_i < 0, \sum w_{ij} z_j > 0$).

### 2.6 Spatial Climate Velocity Vector Field (Burrows et al., Nature 2011)
Local climate velocity represents the instantaneous geographic displacement rate required for an organism or ecosystem to maintain isoclines:

$$\mathbf{V} = \frac{\frac{\partial T}{\partial t}}{\|\nabla T\|} \hat{\mathbf{u}} = \frac{\beta}{\sqrt{\left(\frac{\partial T}{\partial x}\right)^2 + \left(\frac{\partial T}{\partial y}\right)^2}} \hat{\mathbf{u}} \quad \left[\text{km} \cdot \text{decade}^{-1}\right]$$

---

## 3. Data Architecture & Ingestion Pipeline

### 3.1 Primary Sensor & Model Collections
EarthSift interfaces with operational reanalysis streams conforming to CF-1.8 NetCDF conventions:
1. **NASA POWER (Prediction of Worldwide Energy Resources)**:
   - *Provider*: NASA Langley Research Center (LaRC).
   - *Resolution*: 0.5° × 0.5° global synoptic grid (1981–present).
   - *Target Variables*: Surface Air Temperature (`T2M`), Corrected Precipitation (`PRECTOTCORR`), Downward Solar Radiative Flux (`ALLSKY_SFC_SW_DWN`).
2. **NASA MERRA-2 (Modern-Era Retrospective Analysis for Research and Applications, Version 2)**:
   - *Provider*: NASA Global Modeling and Assimilation Office (GMAO).
   - *Resolution*: 0.5° × 0.625° assimilation model (`M2TMNXSLV`, `M2TMNXFLX`).
   - *DOI Citation*: `10.5067/POWER/10.0.0` / `10.5067/VJAFPLI1CSIV`.

### 3.2 Dual-Tier Caching Architecture
To maintain interactive sub-50ms query responses without saturating upstream NASA gateways:
- **Tier 1 (L1 RAM)**: Thread-safe in-memory LRU cache (`collections.OrderedDict` guarded by `threading.Lock`) holding full parsed spatial responses.
- **Tier 2 (L2 Storage)**: SQLite indexed B-Tree cache (`earthdata_cache.db`) with WAL journal mode and TTL expiration index storing compressed serialized telemetry.

---

## 4. Cryptographic Reproducibility & Open Science Granules

To satisfy peer-review reproducibility standards, every EarthSift analytical run produces deterministic science artifacts:

1. **CF-1.8 NetCDF-4 Granule (`.nc`)**:
   - Encodes coordinate axes (`latitude`, `longitude`, `time`), metadata attributes, bounding boxes, and non-parametric data fields (`slope`, `p_value`, `lisa_cluster`).
   - Fully inspectable via NASA Panoply, QGIS, GDAL, or Python `xarray`.
2. **GeoJSON FeatureCollection (`.geojson`)**:
   - RFC 7946 compliant polygon feature collections for seamless import into Mapbox, ArcGIS, and Leaflet.
3. **Executable Reproducibility Notebook (`.ipynb`)**:
   - Self-contained, zero-dependency Jupyter notebook embedding numpy/scipy implementations of Mann-Kendall, Sen's slope, and Pettitt changepoint routines alongside embedded study data for 100% independent replication in Google Colab or JupyterLab.
4. **NASA Scientific Memorandum (`.tex`)**:
   - Publication-ready LaTeX technical briefing following NASA SP-7000 / JPL technical memorandum conventions.
5. **Cryptographic Checksumming**:
   - Every exported artifact includes an immutable HMAC-SHA256 hash verifying data integrity against silent bitrot or tampering.

---

## 5. Local Deployment & Container Specification

### Prerequisites
- Python 3.12 or higher
- Node.js 20+ and npm 10+
- (Optional) Docker Engine 24+ & Docker Compose v2

### Option A: Production Container Deployment (Docker)
```bash
docker compose up --build -d
```
The application will be live at:
- Frontend GIS Workspace: `http://localhost:3000`
- FastAPI Scientific Telemetry Server: `http://localhost:8000`
- Interactive OpenAPI / Swagger Documentation: `http://localhost:8000/docs`

### Option B: Native Development Setup
1. **Backend Service**:
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\Activate.ps1
# Unix:
source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

2. **Frontend Workstation**:
```bash
cd frontend-react
npm install
npm run dev
```

---

## 6. Benchmark Telemetry & Test Suite Verification

The EarthSift test suite validates numerical convergence, boundary defenses, and security hardening across **86 comprehensive tests**.

```bash
cd backend
python -m pytest tests/ -v
```

### Verified Test Matrix (86/86 Passing)
- `tests/test_science.py`: Mann-Kendall monotonic sign consistency, Sen's slope convergence, Pettitt regime changepoints, Moran's I autocorrelation.
- `tests/test_netcdf_export.py`: CF-1.8 NetCDF-4 schema validation, variable dimensions, and fill-value conformance.
- `tests/test_championship_features.py`: Climate velocity vector fields (Burrows et al.), Archimedean copula compound risk, NLQ spatial parser, and LaTeX generation.
- `tests/test_security_hardening.py`: OWASP Top 10 defenses, Content-Security-Policy injection, rate limiting, and bounding box parameter sanitization.
- `tests/test_integration.py`: End-to-end API pipeline, dual-tier cache roundtrips, and synthetic-to-live fallback integrity.

```text
============================== 86 passed in 7.42s ==============================
```

---

## License & Attribution

EarthSift is open-source software released under the [MIT License](LICENSE).  
Developed by **Shivam Gawade** (`CertXchange@gmail.com`) for the **NASA Space Apps Challenge 2026**.
