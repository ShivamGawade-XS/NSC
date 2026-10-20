"""
EarthSift — Compound Climate Hazard & Decoupling Engine
Cross-analyzes multi-variable climate trends (e.g. Temperature + Precipitation)
to identify compound geophysical divergence:
- Compound Aridification / Megadrought Regimes (Warming + Drying)
- Hydrological Acceleration / Convective Extreme Regimes (Warming + Pluvial)
- Pluvial Thermal Buffering
"""

from typing import Any

import numpy as np


def compute_compound_hazard(
    temp_slopes: np.ndarray,
    precip_slopes: np.ndarray,
    temp_sig: np.ndarray | None = None,
    precip_sig: np.ndarray | None = None
) -> dict[str, Any]:
    """
    Compute multi-hazard compound divergence across matching spatial grids.

    Parameters:
        temp_slopes: 2D array of temperature trends (°C / decade).
        precip_slopes: 2D array of precipitation trends (mm/day / decade).
        temp_sig: Optional boolean mask of significant temperature trends.
        precip_sig: Optional boolean mask of significant precipitation trends.

    Returns:
        Dict with compound hazard classification array, CAI (Compound Aridification Index),
        and aggregate regional risk exposure statistics.
    """
    shape = temp_slopes.shape
    valid_mask = ~np.isnan(temp_slopes) & ~np.isnan(precip_slopes)
    n_valid = int(np.sum(valid_mask))

    cai_map = np.zeros(shape, dtype=float)
    hazard_map = np.full(shape, "neutral_baseline", dtype=object)

    if n_valid < 4:
        res = {
            "cai_map": cai_map,
            "hazard_classification": hazard_map,
            "aridification_fraction": 0.0,
            "intensification_fraction": 0.0,
            "summary": "Insufficient joint spatial points for compound hazard analysis."
        }
        if temp_sig is not None or precip_sig is not None:
            res["significant_compound_fraction"] = 0.0
        return res

    # Standardize slopes across valid cells
    t_vals = temp_slopes[valid_mask]
    p_vals = precip_slopes[valid_mask]

    t_std = float(np.std(t_vals)) if np.std(t_vals) > 1e-6 else 1.0
    p_std = float(np.std(p_vals)) if np.std(p_vals) > 1e-6 else 1.0

    z_t = (temp_slopes - float(np.mean(t_vals))) / t_std
    z_p = (precip_slopes - float(np.mean(p_vals))) / p_std

    # Compound Aridification Index: High Z(T) combined with Low Z(P)
    cai = z_t - z_p
    cai_map[valid_mask] = np.round(cai[valid_mask], 3)

    # Vectorized classification using np.select
    cond_severe_arid = valid_mask & (temp_slopes > 0) & (precip_slopes < 0) & (cai > 0.5)
    cond_mod_drying = valid_mask & (temp_slopes > 0) & (precip_slopes < 0) & (cai <= 0.5)
    cond_intens = valid_mask & (temp_slopes > 0) & (precip_slopes > 0)
    cond_buffer = valid_mask & (temp_slopes <= 0) & (precip_slopes >= 0)

    condlist = [cond_severe_arid, cond_mod_drying, cond_intens, cond_buffer]
    choicelist = [
        "severe_aridification",
        "moderate_drying",
        "hydrologic_intensification",
        "thermal_buffering",
    ]
    hazard_map = np.select(condlist, choicelist, default="neutral_baseline")

    arid_count = int(np.sum(cond_severe_arid))
    intens_count = int(np.sum(cond_intens))

    arid_frac = round(arid_count / max(1, n_valid), 3)
    intens_frac = round(intens_count / max(1, n_valid), 3)

    # Compute Archimedean Copula Joint Multi-Hazard Return Periods
    from app.science.copula_hazard import compute_compound_copula_return_periods
    copula_results = compute_compound_copula_return_periods(
        temp_slopes=temp_slopes,
        precip_slopes=precip_slopes,
        base_timestep_years=10.0
    )

    res_dict = {
        "cai_map": cai_map,
        "hazard_classification": hazard_map,
        "aridification_fraction": arid_frac,
        "intensification_fraction": intens_frac,
        "copula_model": copula_results.get("copula_model", {}),
        "joint_return_periods_years": copula_results.get("joint_return_periods_years", np.full(shape, 10.0)),
        "max_return_period_years": copula_results.get("max_return_period_years", 10.0),
        "compound_extreme_cells": copula_results.get("compound_extreme_cells", 0),
        "total_analyzed_cells": n_valid,
        "summary": (
            f"Analyzed {n_valid} cells. Aridification regime covers {arid_frac*100:.1f}% "
            f"of domain; hydrological intensification covers {intens_frac*100:.1f}%. "
            f"Archimedean Copula identified {copula_results.get('compound_extreme_cells', 0)} "
            f"hotspots with joint compound return period > 50 years."
        )
    }

    if temp_sig is not None or precip_sig is not None:
        t_sig_arr = np.asarray(temp_sig, dtype=bool) if temp_sig is not None else np.zeros(shape, dtype=bool)
        p_sig_arr = np.asarray(precip_sig, dtype=bool) if precip_sig is not None else np.zeros(shape, dtype=bool)
        joint_sig_mask = valid_mask & (t_sig_arr | p_sig_arr)
        res_dict["significant_compound_fraction"] = round(float(np.sum(joint_sig_mask)) / max(1, n_valid), 3)

    return res_dict

