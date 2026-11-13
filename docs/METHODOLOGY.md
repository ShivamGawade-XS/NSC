# Tellura — Scientific Methodology & Statistical Specifications

**Challenge:** NASA Space Apps 2026 — *Be An Earth System Trend Detective!*  
**Document:** `docs/METHODOLOGY.md`  
**Status:** Non-Parametric Mathematical Architecture (Peer-Reviewed Statistical Formulations)  

---

## 1. Mathematical Foundations
Tellura implements a robust, non-parametric statistical pipeline designed specifically for multi-decadal Earth observation data where non-normality, missingness, serial autocorrelation, and spatial multiplicity are ubiquitous.

---

## 2. Monotonic Trend Test: Mann-Kendall ($S$ Statistic)
For a time series $y = (y_1, y_2, \dots, y_n)$, the Mann-Kendall test statistic $S$ evaluates the monotonic direction:

$$S = \sum_{i=1}^{n-1} \sum_{j=i+1}^n \text{sgn}(y_j - y_i)$$

where:
$$\text{sgn}(\theta) = \begin{cases} +1 & \text{if } \theta > 0 \\ 0 & \text{if } \theta = 0 \\ -1 & \text{if } \theta < 0 \end{cases}$$

Kendall’s rank correlation coefficient $\tau$ is defined as:
$$\tau = \frac{S}{n(n-1)/2}$$

The asymptotic baseline variance under the null hypothesis of i.i.d. observations with tie corrections is:

$$\text{Var}(S) = \frac{n(n-1)(2n+5) - \sum_{t} t(t-1)(2t+5)}{18}$$

where $t$ denotes the count of observations in each tied group. A numerical stability floor $\text{Var}(S) \ge 1.0$ is enforced.

---

## 3. Autocorrelation Correction: Hamed & Rao (1998)
Standard Mann-Kendall variance assumes independent, identically distributed (i.i.d.) observations. In geophysical and atmospheric series (such as MERRA-2 surface temperature), serial persistence ($AR(1)$ red noise) inflates the variance of $S$, causing false positive trend detections.

Tellura implements the **Hamed & Rao (1998)** modified variance:
1. The series is first detrended using Sen's slope: $e_t = y_t - \beta \cdot t$.
2. The empirical autocorrelation $\rho^*(k)$ of the ranks of residuals is computed for lags $k = 1, \dots, \min(n-4, 10)$ to avoid noisy high-order lag estimation on finite sample records.
3. Significant autocorrelation coefficients exceeding the two-tailed 95% confidence bounds ($\pm 1.96 / \sqrt{n}$) adjust the variance:

$$\text{Var}^*(S) = \text{Var}(S) \times \left[ 1 + \frac{2}{n(n-1)(n-2)} \sum_{k=1}^{n-1} (n-k)(n-k-1)(n-k-2) \rho^*(k) \right]$$

The standardized test statistic $Z$ is calculated with continuity correction:
$$Z = \begin{cases} \frac{S - 1}{\sqrt{\text{Var}^*(S)}} & \text{if } S > 0 \\ 0 & \text{if } S = 0 \\ \frac{S + 1}{\sqrt{\text{Var}^*(S)}} & \text{if } S < 0 \end{cases}$$

Two-tailed p-value:
$$p = 2 \cdot \left[1 - \Phi(|Z|)\right]$$

---

## 4. Robust Rate Estimator: Sen’s Slope (Theil-Sen)
Sen’s non-parametric estimator calculates the median of all pairwise temporal slopes, rendering it immune to outliers up to a 29% breakdown point:

$$\beta = \text{median} \left\{ \frac{y_j - y_i}{t_j - t_i} : 1 \le i < j \le n \right\}$$

Intercept $\alpha$ is calculated as the median of residual deviations:
$$\alpha = \text{median} \left\{ y_i - \beta \cdot t_i : 1 \le i \le n \right\}$$

Rates are reported in standardized physical units per decade:
$$\beta_{\text{decadal}} = \beta_{\text{annual}} \times 10$$

---

## 5. Multiple Hypothesis Testing: Benjamini-Hochberg FDR
When testing $m$ spatial grid cells simultaneously across a geographical domain, traditional single-test $\alpha = 0.05$ thresholds produce numerous false discoveries.

Tellura applies the **Benjamini-Hochberg (1995)** procedure to bound the expected proportion of false discoveries (False Discovery Rate) below $q \le 0.05$ under independence or positive regression dependency (PRDS):
1. Sort raw p-values in ascending order: $p_{(1)} \le p_{(2)} \le \dots \le p_{(m)}$.
2. Find the largest rank $k$ such that:
$$p_{(k)} \le \frac{k}{m} \cdot \alpha$$
3. All hypotheses with rank $i \le k$ are declared statistically significant under FDR control.
4. Monotonic adjusted $q$-values are computed backwards:
$$q_{(i)} = \min \left( q_{(i+1)}, \frac{m}{i} \cdot p_{(i)} \right)$$

---

## 6. Discovery Engine: Candidate Signal Scoring
The "Discovery Scan" feature ranks all spatial cells according to a transparent, documented composite score:

$$\text{discovery\_score} = |\beta| \times w_{\text{sig}} \times \text{completeness} \times (1.0 + \text{coherence})$$

- $|\beta|$: Absolute Sen's slope magnitude.
- $w_{\text{sig}}$: Significance weight prioritizing FDR-controlled discoveries:
  - $1.0$ if FDR significant ($q \le 0.05$)
  - $0.2$ if raw significant ($p \le 0.05$ only)
  - $0.01$ if non-significant
- $\text{completeness}$: Fraction of valid, non-missing observations ($n_{\text{valid}} / n_{\text{total}}$).
- $\text{coherence}$: Fraction of valid adjacent neighbors (Queen 2D convolution normalized by the actual count of valid neighbor cells, avoiding edge-cell penalty) sharing the same statistically significant trend direction.

---

## 7. Regime Shift Detection & Known Caveats (Pettitt 1979)
Tellura implements the non-parametric Pettitt (1979) change-point test to identify abrupt temporal regime shifts:
$$K = \max_{1 \le t < n} |U_{t, n}|, \quad U_{t, n} = \sum_{i=1}^t \sum_{j=t+1}^n \text{sgn}(y_i - y_j)$$
Two-tailed change-point significance:
$$p \approx 2 \exp\left( \frac{-6 K^2}{n^3 + n^2} \right)$$

> **Methodological Caveat on Pettitt**: The Pettitt test evaluates the null hypothesis of stationarity against an abrupt single step-change. In series exhibiting a strong monotonic trend, cumulative rank sums naturally peak near the temporal midpoint ($t \approx n/2$). In Tellura, Pettitt changepoints are presented alongside the continuous Theil-Sen slope so researchers can discern true step regime shifts from continuous gradual drift.

---

## 8. Spatial Autocorrelation & Clustering (Anselin LISA)
Local spatial association is evaluated via Anselin (1995) Local Moran's $I_i$:
$$I_i = \frac{z_i - \bar{z}}{s^2} \sum_{j=1}^m w_{ij} (z_j - \bar{z})$$
where $w_{ij}$ represents row-standardized inverse-distance spatial weights. Grid cells are categorized into High-High (Hotspots), Low-Low (Coldspots), High-Low, and Low-High spatial regimes.

> **Methodological Note on LISA**: Per-cell significance ($p \le 0.05$) is computed against analytical standard normal permutations. Users are advised that global field multiplicity is controlled primarily through the domain-wide Benjamini-Hochberg FDR mask.

---

## 9. Contrast Engine: Regional Divergence
The Contrast Engine locates spatial cluster pairs displaying statistically significant trends in opposite directions ($\beta_1 > 0$ and $\beta_2 < 0$) over the identical temporal period:
- Magnitude Delta: $\Delta = |\bar{\beta}_{\text{pos}} - \bar{\beta}_{\text{neg}}|$
- **Scientific Limitation:** Regional divergence does not imply a shared causal driver without physical process attribution and hydrodynamic modeling.

---

## 10. Temporal Aggregation & Multi-Hazard Copulas

### Temporal Resolution & Ingestion Standards
- **NASA POWER Annual Encoding:** When querying the NASA POWER API, annual means are ingested directly from NASA's official `YYYY13` 13th-month parameter encoding. In cases where annual records are derived from monthly series, a strict minimum threshold of $\ge 6$ valid calendar months per year is required; years with insufficient coverage are treated as missing (`NaN`) to prevent seasonal bias.
- **MERRA-2 Reanalysis:** Hourly/daily assimilation fields are aggregated to annual means over complete calendar years ($N \ge 360$ valid daily steps).

### Archimedean Copula Compound Risk (Gumbel & Clayton)
To model joint compound hazards (e.g., concurrent temperature spikes and precipitation deficits), Tellura fits bivariate Archimedean copulas:
- **Gumbel Copula** (Upper tail dependence $\lambda_U = 2 - 2^{1/\theta}$): parameter $\theta = 1 / (1 - \tau)$.
- **Clayton Copula** (Lower tail dependence $\lambda_L = 2^{-1/\theta}$): parameter $\theta = 2\tau / (1 - \tau)$.
- **Sample Length Caveat:** Bivariate return periods $T = 1 / P(U > u, V > v)$ exceeding the observational record length ($n \approx 44$ years) represent parametric tail extrapolations subject to sampling uncertainty and should be interpreted as relative hazard metrics rather than absolute design return periods.
