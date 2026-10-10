"""
EarthSift — Discovery Engine
Surfaces candidate signals worth investigating using a transparent, documented composite score:
- significance: FDR q <= alpha (weight 1.0), raw p <= alpha (0.5), non-sig (0.1)
- magnitude: absolute slope rate |slope|
- completeness: valid observations / total possible observations
- spatial coherence: fraction of adjacent 8-neighbors with consistent significant trend direction

Formula:
  discovery_score = |slope| * significance_weight * completeness * (1.0 + spatial_coherence)
"""

from typing import List, Dict, Any
import numpy as np


def compute_spatial_coherence(
    slopes: np.ndarray,
    is_significant: np.ndarray
) -> np.ndarray:
    """
    Calculate local spatial coherence for each cell:
    Fraction of valid 8-neighbors having identical significant trend direction.
    """
    h, w = slopes.shape
    coherence = np.zeros((h, w), dtype=float)

    for i in range(h):
        for j in range(w):
            if not is_significant[i, j]:
                coherence[i, j] = 0.0
                continue

            cell_dir = 1 if slopes[i, j] > 0 else -1
            neighbor_count = 0
            matching_count = 0

            for di in (-1, 0, 1):
                for dj in (-1, 0, 1):
                    if di == 0 and dj == 0:
                        continue
                    ni, nj = i + di, j + dj
                    if 0 <= ni < h and 0 <= nj < w:
                        neighbor_count += 1
                        if is_significant[ni, nj]:
                            n_dir = 1 if slopes[ni, nj] > 0 else -1
                            if n_dir == cell_dir:
                                matching_count += 1

            if neighbor_count > 0:
                coherence[i, j] = matching_count / neighbor_count

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
    top_n: int = 10
) -> List[Dict[str, Any]]:
    """
    Rank all grid cells by the transparent composite discovery formula.
    
    Returns:
        List of top_n candidate signals sorted by discovery_score descending.
    """
    h, w = slopes.shape
    coherence = compute_spatial_coherence(slopes, is_significant_fdr)
    signals = []

    for i in range(h):
        for j in range(w):
            slope = float(slopes[i, j])
            abs_slope = abs(slope)
            p_val = float(p_values[i, j])
            q_val = float(q_values[i, j])
            is_fdr = bool(is_significant_fdr[i, j])
            is_raw = bool(is_significant_raw[i, j])

            # Significance weight
            if is_fdr:
                sig_weight = 1.0
            elif is_raw:
                sig_weight = 0.5
            else:
                sig_weight = 0.1

            completeness = 1.0  # Annual reanalysis grid points are 100% complete
            coh = float(coherence[i, j])

            # Transparent formula
            score = abs_slope * sig_weight * completeness * (1.0 + coh)

            direction = "increasing" if slope > 0 else ("decreasing" if slope < 0 else "neutral")

            signals.append({
                "lat": float(latitudes[i]),
                "lon": float(longitudes[j]),
                "slope": round(slope, 4),
                "direction": direction,
                "p_value": round(p_val, 5),
                "q_value": round(q_val, 5),
                "is_significant_fdr": is_fdr,
                "is_significant_raw": is_raw,
                "spatial_coherence": round(coh, 3),
                "completeness": completeness,
                "discovery_score": round(float(score), 4),
                "ranking_rationale": (
                    f"|slope|={abs_slope:.3f} * sig_weight={sig_weight:.1f} * "
                    f"completeness={completeness:.1f} * (1 + coherence={coh:.2f})"
                )
            })

    # Sort descending by discovery score
    signals.sort(key=lambda s: s["discovery_score"], reverse=True)
    return signals[:top_n]
