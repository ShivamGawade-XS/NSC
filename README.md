# 🌍 EarthSift

> **Find the changes worth investigating.**  
> An evidence-first Earth-system trend discovery platform built for the **NASA Space Apps Challenge 2026**.

[![NASA Space Apps Challenge 2026](https://img.shields.io/badge/NASA%20Space%20Apps-2026-0B3D91?style=for-the-badge&logo=nasa)](https://www.spaceappschallenge.org/2026/challenges/be-an-earth-system-trend-detective/)
[![Challenge](https://img.shields.io/badge/Challenge-Be%20An%20Earth%20System%20Trend%20Detective!-blue?style=for-the-badge)](https://www.spaceappschallenge.org/2026/challenges/be-an-earth-system-trend-detective/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

---

## 🛰️ Challenge Mandate

In the **2026 NASA Space Apps Challenge — *Be An Earth System Trend Detective!***, teams are tasked with:
> *"Find and examine variables measured by NASA missions or produced by NASA models, visualize how they change over time, and determine what is changing, where it is changing, how much it is changing, and if these changes are what scientists call 'significant.'"*

---

## 💡 The EarthSift Thesis

Many applications approaching Earth observation data build a standard pipeline:
$$\text{NASA Data} \longrightarrow \text{Map} \longrightarrow \text{Chart} \longrightarrow \text{AI Chatbot}$$

**EarthSift takes a strictly scientific, evidence-first approach:**

```text
NASA Earth-System Data
        │
        ▼
Data Validation & Unit Normalization
        │
        ▼
Non-Parametric Trend Estimation (Theil-Sen Slope)
        │
        ▼
Statistical Significance Testing (Mann-Kendall)
        │
        ▼
Multiplicity Control (Benjamini-Hochberg FDR)
        │
        ▼
Spatial Discovery & Contrasting Region Analysis
        │
        ▼
Structured Evidence & Provenance Ledger
        │
        ▼
Interactive Scientific Instrument (Map & Time Series)
        │
        ▼
Downstream AI Explainer (Interpreting verified data only)
```

> **Core Axiom:** *The scientific engine is the product. The map is the instrument. AI is an interpreter, not the calculator.*

---

## 🌟 Key Features

1. **Robust Trend Magnitude (Sen's Slope):** Outlier-resistant median-of-slopes estimator providing physically grounded trend rates (e.g., $+0.45\ ^\circ\text{C} / \text{decade}$) rather than noisy linear fits.
2. **Monotonic Significance (Mann-Kendall Test):** Non-parametric rank-based statistical testing tailored for skewed, non-Gaussian environmental records.
3. **Multiplicity Correction (False Discovery Rate):** Controls error rates across thousands of spatial grid cells using Benjamini-Hochberg (BH) adjustments, filtering out statistical flukes.
4. **Opposing Regional Contrasts ("Find Contrasts"):** Automatically discovers and pairs geographical regions experiencing opposite trends for the same variable and time window (e.g., simultaneous regional wetting vs. drying).
5. **Interactive Time-Series Drilldown:** Click any cell on the GPU-rendered map to view historical observations, seasonal baselines, and trend confidence intervals.
6. **Scientific Transparency & Provenance:** Every displayed finding is backed by an inspectable evidence record detailing sample coverage, algorithm parameters, and source DOIs.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Data Ingestion** | NASA Earthdata / CMR API, `earthaccess`, `xarray` |
| **Scientific Engine** | Python, `numpy`, `scipy`, `pyMannKendall` |
| **API & Backend** | FastAPI, Pydantic, Uvicorn |
| **Geospatial Mapping** | MapLibre GL JS |
| **Data Visualization** | Apache ECharts |
| **Web Shell** | Next.js, TypeScript, Tailwind CSS |

---

## 📚 Documentation Index

Comprehensive documentation is available in the [`docs/`](docs/) directory:

* 📐 [**System Architecture & Pipeline**](docs/ARCHITECTURE.md): End-to-end design, data flow, and UI specifications.
* 🔬 [**Scientific Methodology**](docs/SCIENTIFIC_METHODOLOGY.md): Mathematics of Mann-Kendall, Sen's slope, and Benjamini-Hochberg FDR.
* 📦 [**Open-Source Research & Licensing**](docs/OPEN_SOURCE_RESEARCH.md): Evaluated packages, dependency choices, and license compliance.
* 📋 [**MVP Technical Specification**](docs/MVP_SPEC.md): API schemas, data contracts, and functional requirements.
* ⏱️ [**Hackathon Execution & Pitch Roadmap**](docs/HACKATHON_PLAN.md): 48-hour build phases and 7-slide presentation structure.
* 🔎 [**Truth & Evidence Ledger**](docs/TRUTH_LEDGER.md): Fact-checking ledger for scientific rigor.
* ⚖️ [**Architecture Decisions (ADR)**](docs/DECISIONS.md): Architectural trade-offs and rationale.

---

## 🔬 Scientific Caveats & Honest Limitations

* **Trend $\neq$ Causation:** Trend detection quantifies empirical change over time but does not prove causal mechanisms.
* **Period Dependence:** Trends are bounded by the observed timeframe; short-term trends do not guarantee long-term trajectories.
* **Resolution Honesty:** Data are represented at native sensor/model resolution without misleading sub-grid interpolation.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
