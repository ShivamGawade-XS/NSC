"""
EarthSift — Spatial Autocorrelation & Clustering Engine
Implements:
1. Global Moran's I with analytical variance, z-score, and p-value.
2. Anselin Local Indicators of Spatial Association (LISA) for Local Moran's I.
3. Classification into High-High (Hotspots), Low-Low (Refugia), High-Low, and Low-High spatial anomalies.
"""

from typing import Any

import numpy as np
from scipy import ndimage, stats

QUEEN_KERNEL = np.array([
    [1.0, 1.0, 1.0],
    [1.0, 0.0, 1.0],
    [1.0, 1.0, 1.0],
], dtype=float)


def compute_global_morans_i(
    values_2d: np.ndarray,
    min_valid: int = 6
) -> dict[str, Any]:
    """
    Calculate Global Moran's I spatial autocorrelation on a 2D spatial grid
    using 2D convolutions (scipy.ndimage.convolve) and exact asymmetric Cliff & Ord (1981)
    weight invariants.

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

    # 1. 2D convolution for neighbor counts and inverse neighbor counts
    nb_counts = ndimage.convolve(valid_mask.astype(float), QUEEN_KERNEL, mode="constant", cval=0.0)
    inv_nb = np.where(valid_mask & (nb_counts > 0), 1.0 / nb_counts, 0.0)

    # Row-standardized Queen contiguity (8-neighbor) spatial lag via 2D convolution
    neighbor_z_sum = ndimage.convolve(z, QUEEN_KERNEL, mode="constant", cval=0.0)
    lag = neighbor_z_sum * inv_nb

    # 2. Exact asymmetric weight invariants (Cliff & Ord 1981)
    # S0 = sum_i I(N_i > 0)
    has_neighbors = valid_mask & (nb_counts > 0)
    s0 = float(np.sum(has_neighbors))
    if s0 <= 0:
        return {
            "moran_i": 0.0,
            "expected_i": float(-1.0 / (n - 1)),
            "z_score": 0.0,
            "p_value": 1.0,
            "interpretation": "Spatial distribution has no connected neighbors."
        }

    # S1 = 1/2 sum_i sum_{j in N(i)} (w_ij + w_ji)^2 = sum_{i: N_i > 0} 1/N_i + sum_{i: N_i > 0} 1/N_i (sum_{j in N(i)} 1/N_j)
    # where sum_{j in N(i)} 1/N_j is computed in one C call via ndimage.convolve(inv_nb, QUEEN_KERNEL, mode="constant", cval=0.0)
    conv_inv_nb = ndimage.convolve(inv_nb, QUEEN_KERNEL, mode="constant", cval=0.0)
    s1 = float(np.sum(inv_nb[has_neighbors]) + np.sum(inv_nb[has_neighbors] * conv_inv_nb[has_neighbors]))

    # S2 = sum_{i: valid} (I(N_i > 0) + sum_{j in N(i)} 1/N_j)^2
    row_plus_col = np.where(valid_mask, has_neighbors.astype(float) + conv_inv_nb, 0.0)
    s2_w = float(np.sum(row_plus_col ** 2))

    # 3. Scale Moran's I properly by (n / S_0) * (sum z_i lag_i / sum z_i^2)
    numerator = float(np.sum(z[valid_mask] * lag[valid_mask]))
    denom = float(np.sum(z[valid_mask] ** 2))
    scale = float(n) / s0
    moran_i = float(scale * (numerator / denom)) if denom > 0 else 0.0
    expected_i = float(-1.0 / (n - 1))

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
        "is_clustered": (p_value < 0.05 and moran_i > 0),
        "interpretation": interpretation
    }


def compute_lisa_clusters(
    values_2d: np.ndarray,
    p_values_2d: np.ndarray | None = None,
    alpha: float = 0.05
) -> tuple[np.ndarray, np.ndarray]:
    """
    Compute Anselin Local Indicators of Spatial Association (LISA)
    using 2D convolutions across the spatial grid.

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

    # 2D convolution for neighbor counts and inverse neighbor counts
    nb_counts = ndimage.convolve(valid_mask.astype(float), QUEEN_KERNEL, mode="constant", cval=0.0)
    inv_nb = np.where(valid_mask & (nb_counts > 0), 1.0 / nb_counts, 0.0)
    neighbor_z_sum = ndimage.convolve(z, QUEEN_KERNEL, mode="constant", cval=0.0)
    lag = neighbor_z_sum * inv_nb

    local_i = np.where(valid_mask, (z / s2) * lag, 0.0)

    # Classify clusters
    is_eval = valid_mask & (np.abs(z) > 1e-4) & (np.abs(lag) > 1e-4)
    if p_values_2d is not None:
        is_eval = is_eval & (p_values_2d <= alpha)

    clusters[is_eval & (z > 0) & (lag > 0)] = "HH"
    clusters[is_eval & (z < 0) & (lag < 0)] = "LL"
    clusters[is_eval & (z > 0) & (lag < 0)] = "HL"
    clusters[is_eval & (z < 0) & (lag > 0)] = "LH"

    return clusters, local_i
