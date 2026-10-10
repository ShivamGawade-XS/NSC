# EarthSift — Scientific Assumptions & Model Boundaries

**Challenge:** NASA Space Apps 2026 — *Be An Earth System Trend Detective!*  
**Document:** `docs/SCIENTIFIC_ASSUMPTIONS.md`  

---

## 1. Explicit Scientific Assumptions

### A. Non-Parametric Monotonicity
- **Assumption:** The statistical test evaluates whether a variable exhibits a monotonic (consistently upward or consistently downward) tendency over the requested time horizon.
- **Boundary:** Mann-Kendall does not test for quadratic, cyclical, regime-shift, or breakpoint behavior. A stationary cyclical signal (e.g. pure El Niño Southern Oscillation without mean drift) is intentionally categorized as `no_trend`.

### B. Outlier Resistance
- **Assumption:** Outlier observations (e.g., severe individual volcanic cooling years or extreme El Niño temperature spikes) should not disproportionately dictate the calculated rate.
- **Boundary:** Sen’s slope calculates the median of all pairwise slopes, which provides a breakdown point of ~29%.

### C. Autocorrelation & Residual Stationarity
- **Assumption:** Climate time series frequently exhibit red noise persistence.
- **Boundary:** The Hamed & Rao (1998) adjustment is applied to the residuals of the Sen trendline. If residuals exhibit positive lag-1 autocorrelation exceeding $1.96/\sqrt{n}$, the variance of the test statistic is inflated to suppress false rejections of the null hypothesis.

### D. Annual Aggregation
- **Assumption:** MVP analyses operate on annual mean fields to remove seasonal harmonic cycles (e.g., summer-to-winter variations) and evaluate decadal trends.
- **Boundary:** Sub-annual (e.g. seasonal warming in winter vs summer) requires pre-whitened Seasonal Mann-Kendall, planned for Phase 6.

### E. Multiple Testing & False Discovery Rate
- **Assumption:** Spatial grid cells are tested concurrently across regional grids of hundreds to thousands of points.
- **Boundary:** Single cell p-values ($p < 0.05$) are insufficient proof of regional significance. Benjamini-Hochberg FDR ($q \le 0.05$) is applied to limit expected false positive proportions.

### F. Correlation vs Causation (The Contrast Boundary)
- **Assumption:** Regions exhibiting opposing trends during the identical period are statistically divergent.
- **Boundary:** Opposing trends (e.g., southwest drying vs northeast wetting) do not prove a common physical driver or causal mechanism without dynamical climate simulation and attribution analysis.

---

## 2. Inviolable Anti-Hallucination Principles
1. Statistical numbers (slope, p-value, q-value, tau) are calculated exclusively via NumPy/SciPy algorithms, never inferred by language models.
2. If synthetic data is displayed, the UI and evidence record MUST visibly state: *"Synthetic test data — not NASA observations."*
3. P-values are never translated into "probabilities that the trend is true."
4. Empirical past trends are never represented as deterministic future forecasts.
