"""
EarthSift — Scientific Trend Analysis Engine
Implements non-parametric Mann-Kendall test, Sen's slope (Theil-Sen),
and Benjamini-Hochberg False Discovery Rate (FDR) multiplicity correction.
"""

from typing import Dict, List, Optional, Tuple, Any
import numpy as np
from scipy import stats


def mann_kendall_test(
    y: np.ndarray,
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Perform the Mann-Kendall monotonic trend test on a 1D time series.
    
    Parameters:
        y: 1D array of temporal observations.
        alpha: Significance threshold (default: 0.05).
        
    Returns:
        Dict containing S, var_s, z, p_value, tau, and boolean 'significant'.
    """
    # Clean NaNs
    valid_mask = ~np.isnan(y)
    data = y[valid_mask]
    n = len(data)

    if n < 5:
        return {
            "s": 0,
            "var_s": 0.0,
            "z": 0.0,
            "p_value": 1.0,
            "tau": 0.0,
            "significant": False,
            "direction": "no_trend",
            "n_samples": n,
        }

    # Pairwise differences: sgn(y[j] - y[i]) for j > i
    # data[None, :] is 1xN (columns j), data[:, None] is Nx1 (rows i)
    diff = data[None, :] - data[:, None]
    sgn = np.sign(diff)
    
    # Strictly upper triangular indices (j > i)
    iu = np.triu_indices(n, k=1)
    s = int(np.sum(sgn[iu]))

    # Tie correction: find identical values
    unique_vals, counts = np.unique(data, return_counts=True)
    tie_groups = counts[counts > 1]
    tie_term = np.sum(tie_groups * (tie_groups - 1) * (2 * tie_groups + 5))

    # Variance of S
    var_s = (n * (n - 1) * (2 * n + 5) - tie_term) / 18.0

    if var_s <= 0:
        z = 0.0
        p_val = 1.0
    else:
        std_s = np.sqrt(var_s)
        if s > 0:
            z = (s - 1) / std_s
        elif s < 0:
            z = (s + 1) / std_s
        else:
            z = 0.0
        
        # Two-tailed p-value
        p_val = float(2.0 * (1.0 - stats.norm.cdf(abs(z))))

    # Kendall's Tau: S / (n * (n - 1) / 2)
    n_pairs = n * (n - 1) / 2.0
    tau = s / n_pairs if n_pairs > 0 else 0.0

    # Trend direction label
    is_sig = p_val < alpha
    if is_sig and s > 0:
        direction = "increasing"
    elif is_sig and s < 0:
        direction = "decreasing"
    else:
        direction = "no_trend"

    return {
        "s": s,
        "var_s": float(var_s),
        "z": float(z),
        "p_value": p_val,
        "tau": float(tau),
        "significant": bool(is_sig),
        "direction": direction,
        "n_samples": n,
    }


def sens_slope(
    y: np.ndarray,
    time_steps: Optional[np.ndarray] = None
) -> Dict[str, float]:
    """
    Calculate the robust Sen's Slope (Theil-Sen estimator) and intercept.
    
    Parameters:
        y: 1D array of values.
        time_steps: Optional numerical time coordinates. If None, uses np.arange(n).
        
    Returns:
        Dict with 'slope' and 'intercept'.
    """
    valid_mask = ~np.isnan(y)
    data = y[valid_mask]
    n = len(data)

    if n < 2:
        return {"slope": 0.0, "intercept": float(data[0]) if n == 1 else 0.0}

    if time_steps is None:
        t = np.arange(len(y), dtype=float)[valid_mask]
    else:
        t = np.asarray(time_steps, dtype=float)[valid_mask]

    # Pairwise slopes (y[j] - y[i]) / (t[j] - t[i]) for j > i
    dt = t[None, :] - t[:, None]
    dy = data[None, :] - data[:, None]
    
    iu = np.triu_indices(n, k=1)
    valid_pairs = dt[iu] != 0
    slopes = dy[iu][valid_pairs] / dt[iu][valid_pairs]

    median_slope = float(np.median(slopes)) if len(slopes) > 0 else 0.0
    intercept = float(np.median(data - median_slope * t))

    return {
        "slope": median_slope,
        "intercept": intercept
    }


def benjamini_hochberg_fdr(
    p_values: np.ndarray,
    alpha: float = 0.05
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Apply Benjamini-Hochberg False Discovery Rate (FDR) multiplicity correction.
    
    Parameters:
        p_values: 1D or ND array of raw p-values (NaNs preserved).
        alpha: Target FDR rate (default: 0.05).
        
    Returns:
        (adjusted_q_values, is_significant_fdr) with identical shape to input.
    """
    orig_shape = p_values.shape
    flat_p = p_values.flatten()
    valid_mask = ~np.isnan(flat_p)
    m = np.sum(valid_mask)

    q_vals = np.full(flat_p.shape, np.nan, dtype=float)
    sig_flags = np.zeros(flat_p.shape, dtype=bool)

    if m == 0:
        return q_vals.reshape(orig_shape), sig_flags.reshape(orig_shape)

    valid_indices = np.where(valid_mask)[0]
    valid_p = flat_p[valid_mask]

    # Sort ascending
    sort_order = np.argsort(valid_p)
    sorted_p = valid_p[sort_order]
    
    # Cumulative minimum for monotonicity: q = p * (m / rank)
    ranks = np.arange(1, m + 1, dtype=float)
    adj_factors = m / ranks
    raw_q = sorted_p * adj_factors

    # Enforce monotonicity backwards: q[i] = min(q[i], q[i+1])
    mono_q = np.minimum.accumulate(raw_q[::-1])[::-1]
    mono_q = np.clip(mono_q, 0.0, 1.0)

    # Place back in original order
    reconstructed_q = np.empty_like(valid_p)
    reconstructed_q[sort_order] = mono_q

    q_vals[valid_indices] = reconstructed_q
    sig_flags[valid_indices] = reconstructed_q <= alpha

    return q_vals.reshape(orig_shape), sig_flags.reshape(orig_shape)


def compute_spatial_trends(
    data_3d: np.ndarray,
    time_coords: Optional[np.ndarray] = None,
    alpha: float = 0.05
) -> Dict[str, np.ndarray]:
    """
    Compute spatial trends across a 3D grid [time, lat, lon].
    
    Parameters:
        data_3d: 3D array of shape (T, H, W).
        time_coords: Optional 1D array of time steps of length T.
        alpha: Significance threshold.
        
    Returns:
        Dict with 2D spatial maps:
          'slopes', 'intercepts', 'p_values', 'q_values',
          'is_significant_raw', 'is_significant_fdr', 'n_samples'
    """
    t_len, h_len, w_len = data_3d.shape
    
    slopes = np.zeros((h_len, w_len), dtype=float)
    intercepts = np.zeros((h_len, w_len), dtype=float)
    p_values = np.ones((h_len, w_len), dtype=float)
    n_samples = np.zeros((h_len, w_len), dtype=int)
    
    for i in range(h_len):
        for j in range(w_len):
            ts = data_3d[:, i, j]
            # Sen's slope
            sen_res = sens_slope(ts, time_steps=time_coords)
            slopes[i, j] = sen_res["slope"]
            intercepts[i, j] = sen_res["intercept"]
            
            # Mann-Kendall
            mk_res = mann_kendall_test(ts, alpha=alpha)
            p_values[i, j] = mk_res["p_value"]
            n_samples[i, j] = mk_res["n_samples"]

    # Benjamini-Hochberg adjustment across the entire 2D spatial field
    q_values, is_sig_fdr = benjamini_hochberg_fdr(p_values, alpha=alpha)
    is_sig_raw = p_values < alpha

    return {
        "slopes": slopes,
        "intercepts": intercepts,
        "p_values": p_values,
        "q_values": q_values,
        "is_significant_raw": is_sig_raw,
        "is_significant_fdr": is_sig_fdr,
        "n_samples": n_samples,
    }
