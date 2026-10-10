# EarthSift — Technical Stack & Dependency Architecture

**Challenge:** NASA Space Apps 2026 — *Be An Earth System Trend Detective!*  
**Verified:** 2026-10-05  

---

## 1. Architecture Overview
EarthSift is structured as a decoupled scientific computing platform with a high-performance Python FastAPI service serving mathematical trend models and a reactive, zero-build client interface designed as an ergonomic scientific instrument.

```
                          ┌───────────────────────────┐
                          │   Frontend Web Client     │
                          │   (Vanilla JS + Leaflet)  │
                          └─────────────┬─────────────┘
                                        │ REST / JSON
                          ┌─────────────▼─────────────┐
                          │   FastAPI Web Service     │
                          │   (Pydantic Strict API)   │
                          └──────┬─────────────┬──────┘
                                 │             │
                    ┌────────────▼──┐       ┌──▼────────────┐
                    │ Data Adapter  │       │ Scientific    │
                    │ Layer         │       │ Engine        │
                    │ - earthaccess │       │ - Mann-Kendall│
                    │ - Synthetic   │       │ - Theil-Sen   │
                    │   Fixture     │       │ - Hamed-Rao   │
                    └───────────────┘       │ - BH-FDR      │
                                            └───────────────┘
```

---

## 2. Backend Technologies

| Component | Technology | Version | Purpose & Rationale |
|---|---|---|---|
| **Language** | Python | 3.13 / 3.14 | Scientific computing runtime with robust C-extension performance. |
| **API Framework** | FastAPI | 0.142.2 | High-throughput asynchronous REST framework with native OpenAPI schema generation. |
| **Validation** | Pydantic | 2.12.5 | Strict input validation, data normalization, and typed API response schemas. |
| **Server** | Uvicorn | 0.42.0 | Production-grade ASGI web server. |
| **Array Math** | NumPy | 2.4.2 | Vectorized 3D array slicing, coordinate sorting, and linear algebra. |
| **Statistics** | SciPy | 1.17.1 | Normal distribution CDF, rank transformations (`scipy.stats.rankdata`). |
| **NASA Access** | `earthaccess` | 0.19.0 | Official NASA CMR search and Earthdata streaming library. |
| **Test Suite** | pytest | 9.0.3 | Automated testing for unit, scientific math, and application resilience suites. |
| **HTTP Client** | HTTPX | 0.28.1 | Synchronous and asynchronous API test client. |

---

## 3. Frontend Technologies

| Component | Technology | Source / Version | Purpose |
|---|---|---|---|
| **Core Structure** | Semantic HTML5 | W3C Standard | Clean, accessible 4-panel scientific layout. |
| **Styling** | Vanilla CSS3 | Custom Design Tokens | Restrained dark palette, high contrast, typography hierarchy, zero bloated CSS frameworks. |
| **Cartography** | Leaflet.js | 1.9.4 | High-performance raster and vector geospatial grid rendering. |
| **Basemap** | CARTO Dark Matter | CartoDB Tiles | Minimalist, dark-neutral tile layer emphasizing data stippling. |
| **Charts** | Chart.js | 4.4.1 | Canvas-rendered interactive time-series plots with Sen's slope trendlines. |
| **Typography** | Inter & JetBrains Mono | Google Fonts CDN | Inter for readable scientific UI; JetBrains Mono for exact numeric coordinates and rates. |

---

## 4. Key Design Decisions
1. **Zero Frontend Build Step:** No Webpack/Vite complexity for client assets. Native ES6 modules and vanilla CSS guarantee immediate reproducibility and offline portability.
2. **Deterministic Fallback Explainer:** No hard dependency on OpenAI or Anthropic API keys. The explainer synthesizes verified mathematical records deterministically.
3. **Dual Runtime Modes:** Clean separation between live NASA streaming (`earthaccess`) and deterministic physics demo fixtures (`is_synthetic: true`).
