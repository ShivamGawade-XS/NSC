"""
EarthSift — Archimedean Copula Multi-Hazard Risk Engine
Models bivariate dependence between thermal extremes (warming) and hydrological deficits (drying)
using Gumbel and Clayton Copulas to estimate joint empirical return periods and compound tail risk.
"""

from typing import Any
import numpy as np
from scipy import stats


def fit_bivariate_copula(
    x: np.ndarray,
    y: np.ndarray,
    copula_type: str = "gumbel"
) -> dict[str, Any]:
    """
    Fit a bivariate Archimedean copula to marginal series x and y.

    Parameters:
        x: 1D array of first variable (e.g., Temperature anomalies).
        y: 1D array of second variable (e.g., Precipitation deficits).
        copula_type: 'gumbel' (upper tail dependence) or 'clayton' (lower tail dependence).

    Returns:
        Dict with parameter theta, Kendall's tau, and copula CDF evaluator.
    """
    valid = ~np.isnan(x) & ~np.isnan(y)
    xv = x[valid]
    yv = y[valid]
    n = len(xv)

    if n < 5:
        return {
            "theta": 1.0,
            "tau": 0.0,
            "copula_type": copula_type,
            "tail_dependence": 0.0,
            "n_samples": n
        }

    # Kendall's tau correlation
    tau_res = stats.kendalltau(xv, yv)
    tau = float(tau_res.statistic) if not np.isnan(tau_res.statistic) else 0.0

    # Invert Kendall's tau to find copula parameter theta
    if copula_type == "gumbel":
        # Gumbel requires tau in [0, 1)
        clamped_tau = max(0.01, min(0.95, abs(tau)))
        theta = float(1.0 / (1.0 - clamped_tau))
        # Upper tail dependence coefficient: lambda_U = 2 - 2^(1/theta)
        tail_dep = float(2.0 - 2.0 ** (1.0 / theta))
    else:  # Clayton
        clamped_tau = max(0.01, min(0.95, abs(tau)))
        theta = float(2.0 * clamped_tau / (1.0 - clamped_tau))
        # Lower tail dependence coefficient: lambda_L = 2^(-1/theta)
        tail_dep = float(2.0 ** (-1.0 / theta))

    return {
        "theta": round(theta, 3),
        "tau": round(tau, 3),
        "copula_type": copula_type,
        "tail_dependence": round(tail_dep, 3),
        "n_samples": n
    }


def evaluate_gumbel_cdf(u: np.ndarray, v: np.ndarray, theta: float) -> np.ndarray:
    """Evaluate bivariate Gumbel copula CDF: C(u,v) = exp(-[(-ln u)^theta + (-ln v)^theta]^(1/theta))."""
    u_safe = np.clip(u, 1e-6, 1.0 - 1e-6)
    v_safe = np.clip(v, 1e-6, 1.0 - 1e-6)
    term = (-np.log(u_safe)) ** theta + (-np.log(v_safe)) ** theta
    return np.exp(-(term ** (1.0 / theta)))


def compute_compound_copula_return_periods(
    temp_slopes: np.ndarray,
    precip_slopes: np.ndarray,
    base_timestep_years: float = 10.0
) -> dict[str, Any]:
    """
    Calculate spatial compound risk return periods using copula modeling.
    For each cell, evaluates the joint return period of co-occurring extreme warming and drying.
    """
    shape = temp_slopes.shape
    valid_mask = ~np.isnan(temp_slopes) & ~np.isnan(precip_slopes)
    n_valid = int(np.sum(valid_mask))

    return_periods = np.full(shape, 10.0, dtype=float)

    if n_valid < 6:
        return {
            "copula_model": {"copula_type": "gumbel", "theta": 1.0, "tau": 0.0},
            "joint_return_periods_years": return_periods,
            "max_return_period_years": 10.0,
            "mean_return_period_years": 10.0,
            "compound_extreme_cells": 0
        }

    t_flat = temp_slopes[valid_mask]
    # For drying, inverted precipitation slopes represent dryness intensity
    p_flat = -precip_slopes[valid_mask]

    # Fit copula across spatial field
    copula_info = fit_bivariate_copula(t_flat, p_flat, copula_type="gumbel")
    theta = copula_info["theta"]

    # Empirical percentiles (probability integral transform)
    ranks_t = stats.rankdata(t_flat) / (n_valid + 1.0)
    ranks_p = stats.rankdata(p_flat) / (n_valid + 1.0)

    # Joint survival probability: P(T > t and Inverted_P > p)
    # Using inclusion-exclusion: P(U > u, V > v) = 1 - u - v + C(u, v)
    c_vals = evaluate_gumbel_cdf(ranks_t, ranks_p, theta)
    p_joint = np.maximum(1e-4, 1.0 - ranks_t - ranks_p + c_vals)

    # Return period T = base_time / P_joint
    ret_flat = base_timestep_years / p_joint
    ret_flat = np.clip(ret_flat, base_timestep_years, 250.0)

    return_periods[valid_mask] = np.round(ret_flat, 1)

    hotspot_count = int(np.sum(ret_flat > 50.0))

    return {
        "copula_model": copula_info,
        "joint_return_periods_years": return_periods,
        "max_return_period_years": round(float(np.max(ret_flat)), 1),
        "mean_return_period_years": round(float(np.mean(ret_flat)), 1),
        "compound_extreme_cells": hotspot_count,
        "summary": (
            f"Copula-derived joint compound extremes: fitted Gumbel theta={theta} "
            f"(Kendall tau={copula_info['tau']}). Identified {hotspot_count} cells with "
            f"joint compound return period > 50 years."
        )
    }
