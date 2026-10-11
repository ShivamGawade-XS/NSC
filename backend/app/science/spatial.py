"""
EarthSift — Spatial Autocorrelation & Clustering Engine
Implements:
1. Global Moran's I with analytical variance, z-score, and p-value.
2. Anselin Local Indicators of Spatial Association (LISA) for Local Moran's I.
3. Classification into High-High (Hotspots), Low-Low (Refugia), High-Low, and Low-High spatial anomalies.
"""

from typing import Any

import numpy as np
from scipy import stats


def compute_global_morans_i(
    values_2d: np.ndarray,
    min_valid: int = 6
) -> dict[str, Any]:
    """
    Calculate Global Moran's I spatial autocorrelation on a 2D spatial grid.

    Parameters:
        values_2d: 2D numpy array (lat x lon) of values (e.g. trend slopes).
        min_valid: Minimum number of non-NaN values required.

    Returns:
        Dict with moran_i, expected_i, z_score, p_value, interpretation.
    """
    h, w = values_2d.shape
    valid_mask = ~np.isnan(values_2d)
    n = int(np.sum(valid_mask))

    if n < min_valid:
        return {
            "moran_i": 0.0,
            "expected_i": 0.0,
            "z_score": 0.0,
            "p_value": 1.0,
            "interpretation": "Insufficient valid spatial cells for spatial autocorrelation."
        }

    mean_val = float(np.mean(values_2d[valid_mask]))
    z = np.zeros_like(values_2d, dtype=float)
    z[valid_mask] = values_2d[valid_mask] - mean_val
    s2 = float(np.mean(z[valid_mask] ** 2))

    if s2 <= 1e-12:
        return {
            "moran_i": 0.0,
            "expected_i": float(-1.0 / (n - 1)),
            "z_score": 0.0,
            "p_value": 1.0,
            "interpretation": "Uniform spatial field (zero variance)."
        }

    # Row-standardized Queen contiguity (8-neighbor) spatial lag
    lag = np.zeros_like(values_2d, dtype=float)
    for r in range(h):
        for c in range(w):
            if not valid_mask[r, c]:
                continue
            r_min, r_max = max(0, r - 1), min(h, r + 2)
            c_min, c_max = max(0, c - 1), min(w, c + 2)
            nb_mask = valid_mask[r_min:r_max, c_min:c_max].copy()
            nb_z = z[r_min:r_max, c_min:c_max].copy()
            nb_mask[r - r_min, c - c_min] = False
            nb_count = int(np.sum(nb_mask))
            if nb_count > 0:
                lag[r, c] = float(np.sum(nb_z[nb_mask])) / nb_count

    numerator = float(np.sum(z[valid_mask] * lag[valid_mask]))
    denom = float(np.sum(z[valid_mask] ** 2))
    moran_i = float(numerator / denom) if denom > 0 else 0.0
    expected_i = float(-1.0 / (n - 1))

    # Analytical variance under randomization assumption (Cliff & Ord 1981)
    # Compute weight matrix statistics: S0, S1, S2
    # Using row-standardized Queen weights
    s0 = 0.0
    s1 = 0.0
    s2_w = 0.0
    for r in range(h):
        for c in range(w):
            if not valid_mask[r, c]:
                continue
            r_min_n, r_max_n = max(0, r - 1), min(h, r + 2)
            c_min_n, c_max_n = max(0, c - 1), min(w, c + 2)
            nb_mask_n = valid_mask[r_min_n:r_max_n, c_min_n:c_max_n].copy()
            nb_mask_n[r - r_min_n, c - c_min_n] = False
            nb_count_n = int(np.sum(nb_mask_n))
            if nb_count_n > 0:
                w_ij = 1.0 / nb_count_n
                row_sum = 0.0
                for dr in range(nb_mask_n.shape[0]):
                    for dc in range(nb_mask_n.shape[1]):
                        if nb_mask_n[dr, dc]:
                            s0 += w_ij
                            s1 += 2.0 * w_ij * w_ij  # (w_ij + w_ji)^2 / 2 simplified
                            row_sum += w_ij
                s2_w += (2.0 * row_sum) ** 2  # (sum_j w_ij + sum_j w_ji)^2

    s0 = max(s0, 1e-6)
    n_f = float(n)
    e_i = -1.0 / (n_f - 1.0)

    # Kurtosis term (b2)
    z_vals = z[valid_mask]
    m2 = float(np.mean(z_vals ** 2))
    m4 = float(np.mean(z_vals ** 4))
    b2 = m4 / (m2 ** 2) if m2 > 1e-12 else 3.0

    # Full randomization variance (Cliff & Ord 1981, eq. 4.6)
    a_term = n_f * ((n_f * n_f - 3.0 * n_f + 3.0) * s1 - n_f * s2_w + 3.0 * s0 * s0)
    b_term = b2 * ((n_f * n_f - n_f) * s1 - 2.0 * n_f * s2_w + 6.0 * s0 * s0)
    c_term = (n_f - 1.0) * (n_f - 2.0) * (n_f - 3.0) * s0 * s0

    var_i = max(1e-8, (a_term - b_term) / c_term - e_i * e_i) if c_term > 0 else max(1e-8, 1.0 / n_f)
    z_score = float((moran_i - expected_i) / np.sqrt(var_i))
    p_value = float(2.0 * (1.0 - stats.norm.cdf(abs(z_score))))

    if p_value < 0.05 and moran_i > 0:
        interpretation = "Statistically significant positive spatial clustering (regional climate regimes)."
    elif p_value < 0.05 and moran_i < 0:
        interpretation = "Statistically significant negative spatial dispersion (mosaic / checkered microclimates)."
    else:
        interpretation = "Spatial distribution is consistent with random spatial variation."

    return {
        "moran_i": round(moran_i, 4),
        "expected_i": round(expected_i, 4),
        "z_score": round(z_score, 3),
        "p_value": float(f"{p_value:.4e}"),
        "is_clustered": bool(p_value < 0.05 and moran_i > 0),
        "interpretation": interpretation
    }


def compute_lisa_clusters(
    values_2d: np.ndarray,
    p_values_2d: np.ndarray | None = None,
    alpha: float = 0.05
) -> tuple[np.ndarray, np.ndarray]:
    """
    Compute Anselin Local Indicators of Spatial Association (LISA).

    Parameters:
        values_2d: 2D array of slopes or values.
        p_values_2d: Optional 2D array of trend significance p-values.
        alpha: Significance cutoff.

    Returns:
        Tuple of (cluster_labels_2d, local_i_2d).
        Cluster labels: 'HH' (Hotspot), 'LL' (Refugium), 'HL' (High Outlier), 'LH' (Low Outlier), 'NS' (Not Sig).
    """
    h, w = values_2d.shape
    valid_mask = ~np.isnan(values_2d)
    clusters = np.full_like(values_2d, "NS", dtype=object)
    local_i = np.zeros_like(values_2d, dtype=float)

    if np.sum(valid_mask) < 6:
        return clusters, local_i

    mean_val = float(np.mean(values_2d[valid_mask]))
    z = np.zeros_like(values_2d, dtype=float)
    z[valid_mask] = values_2d[valid_mask] - mean_val
    s2 = float(np.mean(z[valid_mask] ** 2))

    if s2 <= 1e-12:
        return clusters, local_i

    lag = np.zeros_like(values_2d, dtype=float)
    for r in range(h):
        for c in range(w):
            if not valid_mask[r, c]:
                continue
            r_min, r_max = max(0, r - 1), min(h, r + 2)
            c_min, c_max = max(0, c - 1), min(w, c + 2)
            nb_mask = valid_mask[r_min:r_max, c_min:c_max].copy()
            nb_z = z[r_min:r_max, c_min:c_max].copy()
            nb_mask[r - r_min, c - c_min] = False
            nb_count = int(np.sum(nb_mask))
            if nb_count > 0:
                lag[r, c] = float(np.sum(nb_z[nb_mask])) / nb_count

    for r in range(h):
        for c in range(w):
            if not valid_mask[r, c]:
                continue
            zi = z[r, c]
            li = lag[r, c]
            li_stat = (zi / s2) * li
            local_i[r, c] = li_stat

            # Only label as cluster if cell has non-trivial deviation
            if abs(zi) > 1e-4 and abs(li) > 1e-4:
                # If cell is statistically significant or has strong local association
                cell_sig = (p_values_2d is None) or (p_values_2d[r, c] <= alpha)
                if cell_sig:
                    if zi > 0 and li > 0:
                        clusters[r, c] = "HH"  # High-High Warming Hotspot
                    elif zi < 0 and li < 0:
                        clusters[r, c] = "LL"  # Low-Low Cooling / Stable Refugium
                    elif zi > 0 and li < 0:
                        clusters[r, c] = "HL"  # Isolated Warm Outlier
                    elif zi < 0 and li > 0:
                        clusters[r, c] = "LH"  # Isolated Cool Outlier
                    else:
                        clusters[r, c] = "NS"
                else:
                    clusters[r, c] = "NS"

    return clusters, local_i
