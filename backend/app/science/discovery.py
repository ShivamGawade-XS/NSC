"""
EarthSift — Discovery Engine
Surfaces candidate signals worth investigating using a transparent, documented composite score:
- significance: FDR q <= alpha (weight 1.0), raw p <= alpha (0.5), non-sig (0.1)
- magnitude: absolute slope rate |slope|
- completeness: valid observations / total possible observations (computed dynamically)
- spatial coherence: fraction of adjacent 8-neighbors with consistent significant trend direction

Formula:
  discovery_score = |slope| * significance_weight * completeness * (1.0 + spatial_coherence)
"""

from typing import Any

import numpy as np
from scipy import ndimage, stats

QUEEN_KERNEL = np.array([
    [1.0, 1.0, 1.0],
    [1.0, 0.0, 1.0],
    [1.0, 1.0, 1.0],
], dtype=float)


def compute_spatial_coherence(
    slopes: np.ndarray,
    is_significant: np.ndarray
) -> np.ndarray:
    """
    Calculate local spatial coherence for each cell:
    Fraction of valid 8-neighbors having identical significant trend direction.
    Uses 2D convolution for vectorized Queen neighborhood calculation.
    """
    if slopes.ndim != 2 or slopes.size == 0:
        return np.zeros_like(slopes, dtype=float)

    kernel = QUEEN_KERNEL
    valid_mask = ~np.isnan(slopes)
    is_sig = is_significant.astype(bool) & valid_mask

    # Count valid neighbors (non-NaN cells within grid boundaries)
    neighbor_count = ndimage.convolve(valid_mask.astype(float), kernel, mode="constant", cval=0.0)

    # Count matching positive significant neighbors and negative significant neighbors via ndimage.convolve
    clean_slopes = np.nan_to_num(slopes, nan=0.0)
    pos_sig = (is_sig & (clean_slopes > 0)).astype(float)
    neg_sig = (is_sig & (clean_slopes < 0)).astype(float)

    pos_neighbors = ndimage.convolve(pos_sig, kernel, mode="constant", cval=0.0)
    neg_neighbors = ndimage.convolve(neg_sig, kernel, mode="constant", cval=0.0)

    matching_count = np.where(clean_slopes > 0, pos_neighbors, np.where(clean_slopes < 0, neg_neighbors, 0.0))

    with np.errstate(divide="ignore", invalid="ignore"):
        coherence = np.where(
            is_sig & (neighbor_count > 0),
            matching_count / np.maximum(neighbor_count, 1.0),
            0.0
        )

    return coherence


def discover_candidate_signals(
    slopes: np.ndarray,
    p_values: np.ndarray,
    q_values: np.ndarray,
    is_significant_raw: np.ndarray,
    is_significant_fdr: np.ndarray,
    latitudes: np.ndarray,
    longitudes: np.ndarray,
    alpha: float = 0.05,
    top_n: int = 10,
    data_3d: np.ndarray | None = None,
    taus: np.ndarray | None = None,
) -> list[dict[str, Any]]:
    """
    Rank all grid cells by the transparent composite discovery formula.
    Computes 2D discovery score array entirely in NumPy and constructs
    dictionaries ONLY for the top_n cells.

    Parameters:
        slopes: 2D array of slopes.
        p_values: 2D array of p-values.
        q_values: 2D array of FDR q-values.
        is_significant_raw: 2D boolean mask.
        is_significant_fdr: 2D boolean mask.
        latitudes: 1D latitude coordinates.
        longitudes: 1D longitude coordinates.
        alpha: significance threshold.
        top_n: number of top candidates to return.
        data_3d: optional (time, lat, lon) raw observations to calculate true completeness and tau.
        taus: optional 2D array of Kendall's tau values.

    Returns:
        List of top_n candidate signals sorted by discovery_score descending.
    """
    h, w = slopes.shape
    valid_mask = ~np.isnan(slopes)
    abs_slopes = np.where(valid_mask, np.abs(slopes), 0.0)

    # Vectorized significance weight: FDR q <= alpha (1.0), raw p <= alpha (0.5), non-sig (0.1)
    sig_weight = np.select(
        [is_significant_fdr & valid_mask, is_significant_raw & valid_mask],
        [1.0, 0.5],
        default=0.1
    )

    # Vectorized data completeness
    if data_3d is not None and data_3d.shape[0] > 0:
        valid_obs_count = np.sum(~np.isnan(data_3d), axis=0)
        completeness_2d = np.round(valid_obs_count / float(data_3d.shape[0]), 3)
    else:
        completeness_2d = np.ones((h, w), dtype=float)

    coherence = compute_spatial_coherence(slopes, is_significant_fdr)

    # 2D Discovery Score array computed entirely in NumPy
    discovery_score_2d = abs_slopes * sig_weight * completeness_2d * (1.0 + coherence)
    discovery_score_2d = np.where(valid_mask, discovery_score_2d, -np.inf)

    flat_scores = discovery_score_2d.ravel()
    # Extract only the top top_n indices using np.argsort(flat_scores)[::-1][:top_n]
    top_indices = np.argsort(flat_scores)[::-1][:top_n]

    signals: list[dict[str, Any]] = []

    for idx in top_indices:
        if flat_scores[idx] == -np.inf:
            continue

        i, j = np.unravel_index(idx, (h, w))
        slope = float(slopes[i, j])
        abs_slope = abs(slope)
        p_val = float(p_values[i, j])
        q_val = float(q_values[i, j])
        is_fdr = bool(is_significant_fdr[i, j])
        is_raw = bool(is_significant_raw[i, j])
        s_weight = float(sig_weight[i, j])
        comp = float(completeness_2d[i, j])
        coh = float(coherence[i, j])
        score = float(discovery_score_2d[i, j])
        direction = "increasing" if slope > 0 else ("decreasing" if slope < 0 else "neutral")

        # Include Kendall's tau if available
        tau_val: float | None = None
        if taus is not None:
            raw_tau = float(taus[i, j])
            if not np.isnan(raw_tau):
                tau_val = round(raw_tau, 4)
        elif data_3d is not None and data_3d.shape[0] >= 3:
            cell_ts = data_3d[:, i, j]
            valid_ts = ~np.isnan(cell_ts)
            if np.sum(valid_ts) >= 3:
                kt_res = stats.kendalltau(np.arange(len(cell_ts))[valid_ts], cell_ts[valid_ts])
                kt_val = float(getattr(kt_res, "statistic", 0.0))
                if not np.isnan(kt_val):
                    tau_val = round(kt_val, 4)

        sig_dict: dict[str, Any] = {
            "lat": float(latitudes[i]),
            "lon": float(longitudes[j]),
            "slope": round(slope, 4),
            "direction": direction,
            "p_value": round(p_val, 5),
            "q_value": round(q_val, 5),
            "is_significant_fdr": is_fdr,
            "is_significant_raw": is_raw,
            "spatial_coherence": round(coh, 3),
            "completeness": comp,
            "discovery_score": round(score, 4),
            "ranking_rationale": (
                f"|slope|={abs_slope:.3f} * sig_weight={s_weight:.1f} * "
                f"completeness={comp:.2f} * (1 + coherence={coh:.2f})"
            ),
        }
        if tau_val is not None:
            sig_dict["tau"] = tau_val

        signals.append(sig_dict)

    return signals
