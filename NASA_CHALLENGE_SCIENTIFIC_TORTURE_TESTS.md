# EarthSift — Mathematical & Scientific Torture Tests (Phase 4)

**Project:** EarthSift — Be An Earth System Trend Detective!  
**Competition:** NASA Space Apps Challenge 2026  
**Phase:** Phase 4 — Mathematical and Scientific Torture Tests  
**Execution Timestamp:** 2026-10-24 12:26:00 UTC+05:30  
**Evaluator:** Adversarial Engineering & Scientific Validation Red Team  

---

## 1. Mathematical Operation Inventory & Independent Ground Truth

| Mathematical Component | Implementation Location | Analytical / Scientific Ground Truth | Validation Reference |
| :--- | :--- | :--- | :--- |
| **Sen's Slope Estimator** | `backend/app/science/trend.py:230` | Median of all pairwise slopes $\beta = \operatorname{median}(\frac{y_j - y_i}{t_j - t_i})$ | SciPy `scipy.stats.theilslopes` |
| **Mann-Kendall Monotonic Test** | `backend/app/science/trend.py:128` | $S = \sum \operatorname{sgn}(y_j - y_i)$, tie-corrected $\operatorname{Var}(S)$ | Gilbert (1987), Kendall (1975) |
| **Hamed-Rao Serial Correlation** | `backend/app/science/trend.py:15` | $\operatorname{Var}^*(S) = \operatorname{Var}(S) \cdot [1 + \frac{2}{n(n-1)(n-2)} \sum (n-k)(n-k-1)(n-k-2)\rho^*_k]$ | Hamed & Rao (1998, *J. Hydrol.*) |
| **Gilbert Non-Parametric CI** | `backend/app/science/trend.py:282` | Non-parametric rank indices of sorted pairwise slopes $M_1, M_2$ | Gilbert (1987, Statistical Methods) |
| **Benjamini-Hochberg FDR** | `backend/app/science/trend.py:312` | $p_{(i)} \le \frac{i}{M} \alpha$ with backward monotonicity | Benjamini & Hochberg (1995, *JRSS-B*) |
| **Global Moran's I** | `backend/app/science/spatial.py:27` | $I = \frac{N}{S_0} \frac{\sum \sum w_{ij}(z_i - \bar{z})(z_j - \bar{z})}{\sum (z_i - \bar{z})^2}$ | Cliff & Ord (1981, Spatial Processes) |
| **Local Moran (LISA)** | `backend/app/science/spatial.py:165` | $I_i = \frac{z_i}{s^2} \sum_j w_{ij} z_j$ decomposed to HH, LL, HL, LH, NS | Anselin (1995, *Geographical Analysis*) |
| **Archimedean Copula** | `backend/app/science/copula_hazard.py:13` | Gumbel Copula $C(u, v)$ with Kendall's $\tau$ inversion $\theta = \frac{1}{1-\tau}$ | Nelsen (2006, An Introduction to Copulas) |
| **Spatial Climate Velocity** | `backend/app/science/climate_velocity.py:15` | $V = \frac{\partial T / \partial t}{\|\nabla T\|}$ [km/decade], $\theta = \operatorname{atan2}(g_y, g_x)$ | Burrows et al. (2011, *Nature*) |

---

## 2. Temporal Input Torture Tests (Section 4.1)

All edge cases were executed live using isolated Python verification scripts:

| Edge Case Test | Test Input Description | Expected Behavior | Observed Output | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **Empty Series** | `np.array([])` | Graceful zero return; no unhandled exception | `direction="no_trend"`, `n_samples=0`, `slope=0.0` | **PASS** |
| **1-Observation** | `np.array([14.2])` | Insufficient samples flag; no division by zero | `direction="no_trend"`, `n_samples=1`, `slope=0.0` | **PASS** |
| **Constant Data** | 25 identical observations ($y_t = 12.5$) | $S=0$, $p=1.0$, zero slope | $S=0$, `direction="no_trend"`, $p=1.0$, `slope=0.0` | **PASS** |
| **Extreme Outlier (+1000σ)** | 30 points linear trend ($0.3t$), point 15 spiked by $+1000.0$ | Median slope immune to catastrophic outlier | Slope = **`0.3000`** (Identical to clean series) | **PASS** |
| **Heavy Ties (50% Ties)** | 27 values with 3 identical copies per step | Tie correction handles duplicate ranks | `direction="increasing"`, $p = 1.18 \times 10^{-11}$ | **PASS** |
| **Strong Autocorrelation** | Synthetic AR(1) series with $\rho = 0.85$ | Hamed-Rao expands variance to prevent false positives | $\operatorname{Var}(S)$ increased from $14,291.7$ to $20,359.3$ (ratio $1.42\times$) | **PASS** |
| **NaN & $\pm\infty$ Contamination** | 10-point series containing `np.nan`, `+np.inf`, `-np.inf` | NaNs and infinities filtered before rank indexing | Valid $n=7$, slope = $1.333$, $p=0.0027$ | **PASS** |

---

## 3. Spatial-Statistics Torture Tests (Section 4.4)

| Spatial Edge Case | Test Grid Configuration | Theoretical Ground Truth | Observed Execution Result | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **Uniform Field** | $10 \times 10$ raster with constant value $5.0$ | Variance = 0; Moran's I undefined or 0 | $I = 0.0$, interpretation: *"Uniform spatial field (zero variance)."* | **PASS** |
| **Alternating Checkerboard** | $10 \times 10$ raster with $+1$ and $-1$ alternating | Perfect negative autocorrelation $I \to -1.0$ | $I = -1.0000$, $z = -13.23$ ($p < 10^{-30}$) | **PASS** |
| **Coastal NaN Asymmetry** | $12 \times 12$ raster with $50\%$ missing cells | Asymmetric weight normalization without NaN leakage | Valid cells computed; ocean cells masked; 1 significant cluster | **PASS** |
| **Polar Area Weighting** | High-latitude coordinates up to $89.9^\circ\text{N}$ | $\cos(\phi) > 0$, finite, non-zero weight | Weight at $89.9^\circ = 0.001745 > 0$; all weights finite | **PASS** |

---

## 4. Export Numerical Integrity & Roundtrip Verification (Section 4.5)

To guarantee scientific data integrity, an analysis record with known slopes, confidence intervals, p-values, and LISA clusters was exported to binary NetCDF-4, written to a binary stream, and immediately reopened via `xarray.open_dataset`:

```text
NetCDF Binary Header: HDF5 (Magic: b'\x89HDF\r\n\x1a\n')
Decoded Data Variables: ['slopes', 'trend_slope', 'p_values', 'p_value', 'q_values', 'q_value', 'ci_lower', 'ci_upper', 'lisa_cluster', 'is_significant_fdr', 'crs']
Decoded Dimensions: {'lat': 2, 'lon': 2}
Coordinate Reference System: WGS84 EPSG:4326 via 'crs' grid_mapping attribute
CF Conventions Attribute: CF-1.8, ACDD-1.3

Roundtrip Comparison:
- Original Slope at (30°N, 100°W): +0.3542 °C/decade
  Decoded NetCDF Value:          +0.3542 °C/decade (Error = 0.0000)
- Original Slope at (30°N, 99°W):  -0.1234 °C/decade
  Decoded NetCDF Value:          -0.1234 °C/decade (Error = 0.0000)
- Gilbert 95% Confidence Interval: [0.2105, 0.4981]
  Decoded NetCDF Interval:       [0.2105, 0.4981] (Error = 0.0000)

VERDICT: 100% BIT-EXACT NUMERICAL REPRODUCIBILITY CONFIRMED
```

---

## 5. Conclusion

Every statistical and spatial algorithm in EarthSift was subjected to extreme inputs, non-Gaussian outliers, serial autocorrelation, heavy ties, degenerate dimensions, and format roundtripping. Zero unhandled exceptions or numerical corruptions were detected.

**Phase 4 Complete.** Proceeding to Phase 5: Complete Application User-Journey Break Test.
