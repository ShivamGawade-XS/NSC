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

    use_gev = False
    c_param = 0.0
    loc_param = 0.0
    scale_param = 1.0

    # If empirical series is provided, compute sample parameters and empirical slope SE;
    # else synthesize based on climatological scaling
    if series is not None:
        clean_s = np.array(series, dtype=float)
        clean_s = clean_s[~np.isnan(clean_s)]
    else:
        clean_s = np.array([], dtype=float)

    if len(clean_s) >= 10:
        mu_1 = float(np.mean(clean_s))
        sigma = float(np.std(clean_s, ddof=1)) if np.std(clean_s, ddof=1) > 1e-4 else 1.0

        # Empirical Sen/OLS residual standard error of decadal slope SE(beta)
        n_pts = len(clean_s)
        t = np.arange(n_pts, dtype=float) / 10.0  # Decadal time axis
        t_diff = t - np.mean(t)
        ss_tt = float(np.sum(t_diff ** 2))
        residuals = (clean_s - np.mean(clean_s)) - slope * t_diff
        res_var = float(np.sum(residuals ** 2)) / max(1, n_pts - 2)
        se_slope = np.sqrt(res_var / max(1e-9, ss_tt))
        scale = max(0.005, float(se_slope))

        # Check skewness and fit GEV if |skew| > 0.5 and len >= 15
        sk = float(stats.skew(clean_s)) if n_pts >= 3 else 0.0
        if n_pts >= 15 and abs(sk) > 0.5:
            try:
                c_fit, loc_fit, scale_fit = stats.genextreme.fit(clean_s)
                if not np.isnan(c_fit) and not np.isnan(loc_fit) and not np.isnan(scale_fit) and scale_fit > 1e-4:
                    c_param, loc_param, scale_param = float(c_fit), float(loc_fit), float(scale_fit)
                    use_gev = True
            except Exception:
                use_gev = False
    else:
        mu_1 = 15.0  # Normalized baseline reference
        sigma = max(0.8, abs(slope) * 2.5)
        scale = max(0.01, abs(slope) * 0.20)

    is_increase = slope >= 0

    if use_gev:
        if is_increase:
            # Event is upper tail anomaly under GEV
            threshold = float(stats.genextreme.ppf(threshold_percentile / 100.0, c_param, loc=loc_param, scale=scale_param))
            p1 = float(1.0 - stats.genextreme.cdf(threshold, c_param, loc=loc_param, scale=scale_param))
            loc_0 = loc_param - anthropogenic_delta
            p0 = float(1.0 - stats.genextreme.cdf(threshold, c_param, loc=loc_0, scale=scale_param))
        else:
            # Event is lower tail anomaly under GEV
            lower_percentile = 100.0 - threshold_percentile
            threshold = float(stats.genextreme.ppf(lower_percentile / 100.0, c_param, loc=loc_param, scale=scale_param))
            p1 = float(stats.genextreme.cdf(threshold, c_param, loc=loc_param, scale=scale_param))
            loc_0 = loc_param - anthropogenic_delta
            p0 = float(stats.genextreme.cdf(threshold, c_param, loc=loc_0, scale=scale_param))
    else:
        if is_increase:
            # Event is upper tail anomaly under Gaussian
            threshold = float(stats.norm.ppf(threshold_percentile / 100.0, loc=mu_1, scale=sigma))
            p1 = float(1.0 - stats.norm.cdf(threshold, loc=mu_1, scale=sigma))
            mu_0 = mu_1 - anthropogenic_delta
            p0 = float(1.0 - stats.norm.cdf(threshold, loc=mu_0, scale=sigma))
        else:
            # Event is lower tail drought / deficit anomaly under Gaussian
            lower_percentile = 100.0 - threshold_percentile  # e.g. 10th percentile
            threshold = float(stats.norm.ppf(lower_percentile / 100.0, loc=mu_1, scale=sigma))
            p1 = float(stats.norm.cdf(threshold, loc=mu_1, scale=sigma))
            mu_0 = mu_1 - anthropogenic_delta
            p0 = float(stats.norm.cdf(threshold, loc=mu_0, scale=sigma))

    # Guard against division by zero
    p0_safe = max(p0, 1e-5)
    p1_safe = max(p1, 1e-5)

    risk_ratio = float(min(100.0, max(0.01, p1_safe / p0_safe)))
    far = float(max(0.0, min(1.0, 1.0 - (1.0 / risk_ratio)))) if risk_ratio >= 1.0 else 0.0

    # Parametric Monte Carlo bootstrap for FAR 90% confidence interval (N = 300)
    rng = np.random.default_rng(seed=42)
    boot_slopes = rng.normal(loc=slope, scale=scale, size=300)
    b_deltas = boot_slopes * n_decades

    if use_gev:
        b_loc0 = loc_param - b_deltas
        if is_increase:
            b_p0 = 1.0 - stats.genextreme.cdf(threshold, c_param, loc=b_loc0, scale=scale_param)
        else:
            b_p0 = stats.genextreme.cdf(threshold, c_param, loc=b_loc0, scale=scale_param)
    else:
        b_mu0 = mu_1 - b_deltas
        if is_increase:
            b_p0 = 1.0 - stats.norm.cdf(threshold, loc=b_mu0, scale=sigma)
        else:
            b_p0 = stats.norm.cdf(threshold, loc=b_mu0, scale=sigma)

    b_p0_safe = np.maximum(b_p0, 1e-5)
    b_rr = np.clip(p1_safe / b_p0_safe, 0.01, 100.0)
    boot_fars = np.where(b_rr >= 1.0, np.clip(1.0 - (1.0 / b_rr), 0.0, 1.0), 0.0)

    ci_lower = float(np.percentile(boot_fars, 5.0))
    ci_upper = float(np.percentile(boot_fars, 95.0))

    if far > 0.5:
        verdict = f"Likelihood increased by {risk_ratio:.1f}x due to persistent multi-decadal drift (FAR = {far:.2f}, 90% CI: [{ci_lower:.2f}, {ci_upper:.2f}])."
    elif far > 0.1:
        verdict = f"Moderate anthropogenic signal detected; event {risk_ratio:.1f}x more likely than unperturbed baseline."
    else:
        verdict = "Dominantly natural internal climate variability; trend attribution inconclusive at selected alpha."

    model_desc = "Generalized Extreme Value (GEV) Tail Model" if use_gev else "Gaussian Tail Model"
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
        "methodology": f"Stott et al. (Nature 2004) & Otto et al. (WWA 2020) Fraction of Attributable Risk (FAR) {model_desc}"
    }
