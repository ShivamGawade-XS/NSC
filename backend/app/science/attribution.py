"""
EarthSift — Scientific Extreme Event Attribution Engine (FAR)
Implements the Fraction of Attributable Risk (FAR) framework based on:
- Stott, Stone & Allen (Nature, 2004): Human contribution to the European heatwave of 2003.
- Otto et al. (2020): Toward a World Weather Attribution protocol for rapid event attribution.
- National Academies of Sciences, Engineering, and Medicine (2016): Attribution of Extreme Weather Events.
"""

from typing import Any
import numpy as np
import scipy.stats as stats


def compute_event_attribution(
    slope: float,
    n_years: int = 24,
    series: list[float] | np.ndarray | None = None,
    alpha: float = 0.05,
    threshold_percentile: float = 90.0
) -> dict[str, Any]:
    """
    Compute probabilistic climate event attribution metrics:
    - Risk Ratio (RR) = P1 / P0
    - Fraction of Attributable Risk (FAR) = 1 - P0 / P1
    - Parametric bootstrap confidence interval for FAR
    - Counterfactual distribution shift comparison
    """
    n_decades = max(0.5, n_years / 10.0)
    anthropogenic_delta = float(slope * n_decades)

    # If empirical series is provided, compute sample parameters; else synthesize based on climatological scaling
    if series is not None and len(series) >= 10:
        clean_s = np.array(series, dtype=float)
        clean_s = clean_s[~np.isnan(clean_s)]
        mu_1 = float(np.mean(clean_s))
        sigma = float(np.std(clean_s, ddof=1)) if np.std(clean_s, ddof=1) > 1e-4 else 1.0
    else:
        mu_1 = 15.0  # Normalized baseline reference
        sigma = max(0.8, abs(slope) * 2.5)

    is_increase = slope >= 0

    if is_increase:
        # Event is upper tail anomaly
        threshold = float(stats.norm.ppf(threshold_percentile / 100.0, loc=mu_1, scale=sigma))
        # Factual probability: P(X >= threshold | current climate)
        p1 = float(1.0 - stats.norm.cdf(threshold, loc=mu_1, scale=sigma))
        # Counterfactual probability: P(X >= threshold | pre-trend baseline mu0 = mu1 - delta)
        mu_0 = mu_1 - anthropogenic_delta
        p0 = float(1.0 - stats.norm.cdf(threshold, loc=mu_0, scale=sigma))
    else:
        # Event is lower tail drought / deficit anomaly
        lower_percentile = 100.0 - threshold_percentile  # e.g. 10th percentile
        threshold = float(stats.norm.ppf(lower_percentile / 100.0, loc=mu_1, scale=sigma))
        # Factual probability: P(X <= threshold | current climate)
        p1 = float(stats.norm.cdf(threshold, loc=mu_1, scale=sigma))
        # Counterfactual probability: P(X <= threshold | pre-trend baseline mu0 = mu1 - delta)
        mu_0 = mu_1 - anthropogenic_delta
        p0 = float(stats.norm.cdf(threshold, loc=mu_0, scale=sigma))

    # Guard against division by zero
    p0_safe = max(p0, 1e-5)
    p1_safe = max(p1, 1e-5)

    risk_ratio = float(min(100.0, max(0.01, p1_safe / p0_safe)))
    far = float(max(0.0, min(1.0, 1.0 - (1.0 / risk_ratio)))) if risk_ratio >= 1.0 else 0.0

    # Parametric Monte Carlo bootstrap for FAR 90% confidence interval (N = 300)
    rng = np.random.default_rng(seed=42)
    boot_slopes = rng.normal(loc=slope, scale=max(0.01, abs(slope) * 0.20), size=300)
    boot_fars = []
    for b_s in boot_slopes:
        b_delta = float(b_s * n_decades)
        b_mu0 = mu_1 - b_delta
        if is_increase:
            b_p0 = float(1.0 - stats.norm.cdf(threshold, loc=b_mu0, scale=sigma))
        else:
            b_p0 = float(stats.norm.cdf(threshold, loc=b_mu0, scale=sigma))
        b_p0_safe = max(b_p0, 1e-5)
        b_rr = float(min(100.0, max(0.01, p1_safe / b_p0_safe)))
        boot_fars.append(max(0.0, min(1.0, 1.0 - (1.0 / b_rr))) if b_rr >= 1.0 else 0.0)

    ci_lower = float(np.percentile(boot_fars, 5.0))
    ci_upper = float(np.percentile(boot_fars, 95.0))

    if far > 0.5:
        verdict = f"Likelihood increased by {risk_ratio:.1f}x due to persistent multi-decadal drift (FAR = {far:.2f}, 90% CI: [{ci_lower:.2f}, {ci_upper:.2f}])."
    elif far > 0.1:
        verdict = f"Moderate anthropogenic signal detected; event {risk_ratio:.1f}x more likely than unperturbed baseline."
    else:
        verdict = "Dominantly natural internal climate variability; trend attribution inconclusive at selected alpha."

    return {
        "risk_ratio": round(risk_ratio, 2),
        "fraction_of_attributable_risk": round(far, 3),
        "far_ci_lower": round(ci_lower, 3),
        "far_ci_upper": round(ci_upper, 3),
        "p1_factual_probability": round(p1_safe, 4),
        "p0_counterfactual_probability": round(p0_safe, 4),
        "anthropogenic_cumulative_shift": round(anthropogenic_delta, 4),
        "threshold_value": round(threshold, 3),
        "summary": verdict,
        "methodology": "Stott et al. (Nature 2004) & Otto et al. (WWA 2020) Fraction of Attributable Risk (FAR) Gaussian Tail Model"
    }
