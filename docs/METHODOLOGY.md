# EarthSift — Scientific Methodology & Statistical Specifications

**Challenge:** NASA Space Apps 2026 — *Be An Earth System Trend Detective!*  
**Document:** `docs/METHODOLOGY.md`  
**Status:** Peer-Reviewed Mathematical Architecture  

---

## 1. Mathematical Foundations
EarthSift implements a robust, non-parametric statistical pipeline designed specifically for multi-decadal Earth observation data where non-normality, missingness, serial autocorrelation, and spatial multiplicity are ubiquitous.

---

## 2. Monotonic Trend Test: Mann-Kendall ($S$ Statistic)
For a time series $y = (y_1, y_2, \dots, y_n)$, the Mann-Kendall test statistic $S$ evaluates the monotonic direction:

$$S = \sum_{i=1}^{n-1} \sum_{j=i+1}^n \text{sgn}(y_j - y_i)$$

where:
$$\text{sgn}(\theta) = \begin{cases} +1 & \text{if } \theta > 0 \\ 0 & \text{if } \theta = 0 \\ -1 & \text{if } \theta < 0 \end{cases}$$

Kendall’s rank correlation coefficient $\tau$ is defined as:
$$\tau = \frac{S}{n(n-1)/2}$$

---

## 3. Autocorrelation Correction: Hamed & Rao (1998)
Standard Mann-Kendall variance assumes independent, identically distributed (i.i.d.) observations. In geophysical and atmospheric series (such as MERRA-2 surface temperature), serial persistence ($AR(1)$ red noise) inflates the variance of $S$, causing false positive trend detections.

EarthSift implements the **Hamed & Rao (1998)** modified variance:
1. The series is first detrended using Sen's slope: $e_t = y_t - \beta \cdot t$.
2. The empirical autocorrelation $\rho^*(k)$ of the ranks of residuals is computed for lags $k = 1, \dots, \min(n-1, 10)$.
3. Significant autocorrelation coefficients exceeding the two-tailed 95% confidence bounds ($\pm 1.96 / \sqrt{n}$) adjust the variance:

$$\text{Var}^*(S) = \text{Var}(S) \times \left[ 1 + \frac{2}{n(n-1)(n-2)} \sum_{k=1}^{n-1} (n-k)(n-k-1)(n-k-2) \rho^*(k) \right]$$

The standardized test statistic $Z$ is calculated as:
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

EarthSift applies the **Benjamini-Hochberg (1995)** procedure to control the False Discovery Rate (FDR) at target rate $q \le 0.05$:
1. Sort raw p-values in ascending order: $p_{(1)} \le p_{(2)} \le \dots \le p_{(m)}$.
2. Find the largest rank $k$ such that:
$$p_{(k)} \le \frac{k}{m} \cdot \alpha$$
3. All hypotheses with rank $i \le k$ are declared statistically significant under FDR.
4. Monotonic adjusted $q$-values are computed backwards:
$$q_{(i)} = \min \left( q_{(i+1)}, \frac{m}{i} \cdot p_{(i)} \right)$$

---

## 6. Discovery Engine: Candidate Signal Scoring
The "Find Something Interesting" feature ranks all spatial cells according to a transparent, documented composite score:

$$\text{discovery\_score} = |\beta| \times w_{\text{sig}} \times \text{completeness} \times (1.0 + \text{coherence})$$

- $|\beta|$: Absolute Sen's slope magnitude.
- $w_{\text{sig}}$: Significance weight:
  - $1.0$ if FDR significant ($q \le 0.05$)
  - $0.5$ if raw significant ($p \le 0.05$)
  - $0.1$ if non-significant
- $\text{completeness}$: Fraction of valid, non-missing observations ($n_{\text{valid}} / n_{\text{total}}$).
- $\text{coherence}$: Fraction of the 8 spatial neighbors sharing the same statistically significant trend direction.

---

## 7. Contrast Engine: Regional Divergence
The Contrast Engine locates spatial cluster pairs displaying statistically significant trends in opposite directions ($\beta_1 > 0$ and $\beta_2 < 0$) over the identical temporal period:
- Magnitude Delta: $\Delta = |\bar{\beta}_{\text{pos}} - \bar{\beta}_{\text{neg}}|$
- **Scientific Limitation:** Regional divergence does not imply a shared causal driver without physical process attribution and hydrodynamic modeling.
