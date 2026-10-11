"""
EarthSift — Scientific Trend Analysis Engine
Implements non-parametric Mann-Kendall test, Hamed & Rao (1998) autocorrelation correction,
Sen's slope (Theil-Sen robust estimator), and Benjamini-Hochberg False Discovery Rate (FDR).
"""

from typing import Any

import numpy as np
from scipy import stats


def hamed_rao_variance_correction(data: np.ndarray, var_s: float) -> float:
    """
    Hamed & Rao (1998) variance correction for serial autocorrelation in Mann-Kendall test.
    Detrends the series using Sen's slope, then calculates autocorrelation on the residuals.
    This prevents a real monotonic trend from being mistakenly penalized as serial persistence.
    """
    n = len(data)
    if n < 8:
        return var_s

    # 1. Detrend series using robust Sen's slope
    sen = sens_slope(data)
    t = np.arange(n, dtype=float)
    residuals = data - sen["slope"] * t

    # 2. Compute ranks of the detrended residuals
    ranks = stats.rankdata(residuals)
    ranks_centered = ranks - np.mean(ranks)
    denom = np.sum(ranks_centered ** 2)
    if denom <= 0:
        return var_s

    # Significant threshold at 95% confidence interval
    sig_limit = 1.96 / np.sqrt(n)
    sum_terms = 0.0

    max_lag = min(n - 1, 10)
    for k in range(1, max_lag + 1):
        rho_k = float(np.sum(ranks_centered[:-k] * ranks_centered[k:]) / denom)
        if abs(rho_k) > sig_limit:
            weight = (n - k) * (n - k - 1) * (n - k - 2)
            sum_terms += weight * rho_k

    if sum_terms > 0:
        n_denom = n * (n - 1) * (n - 2)
        if n_denom > 0:
            correction_factor = 1.0 + (2.0 / n_denom) * sum_terms
            return float(var_s * max(1.0, correction_factor))
    return var_s


def mann_kendall_test(
    y: np.ndarray,
    alpha: float = 0.05,
    correct_autocorrelation: bool = True
) -> dict[str, Any]:
    """
    Perform the Mann-Kendall monotonic trend test on a 1D time series.
    
    Parameters:
        y: 1D array of temporal observations.
        alpha: Significance threshold (default: 0.05).
        correct_autocorrelation: If True, applies Hamed & Rao (1998) variance correction.
        
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
    diff = data[None, :] - data[:, None]
    sgn = np.sign(diff)
    
    # Strictly upper triangular indices (j > i)
    iu = np.triu_indices(n, k=1)
    s = int(np.sum(sgn[iu]))

    # Tie correction: find identical values
    _unique_vals, counts = np.unique(data, return_counts=True)
    tie_groups = counts[counts > 1]
    tie_term = np.sum(tie_groups * (tie_groups - 1) * (2 * tie_groups + 5))

    # Base variance of S
    var_s = (n * (n - 1) * (2 * n + 5) - tie_term) / 18.0

    # Apply Hamed & Rao autocorrelation variance correction if requested
    if correct_autocorrelation and var_s > 0:
        var_s = hamed_rao_variance_correction(data, var_s)

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
    time_steps: np.ndarray | None = None,
    alpha: float = 0.05,
    var_s: float | None = None
) -> dict[str, float]:
    """
    Calculate the robust Sen's Slope (Theil-Sen estimator), intercept,
    and Gilbert (1987) non-parametric (1 - alpha)% confidence intervals.
    
    Parameters:
        y: 1D array of values.
        time_steps: Optional numerical time coordinates. If None, uses np.arange(n).
        alpha: Significance level for confidence interval (default: 0.05 -> 95% CI).
        var_s: Optional precomputed Mann-Kendall variance of S.
        
    Returns:
        Dict with 'slope', 'intercept', 'ci_lower', 'ci_upper'.
    """
    valid_mask = ~np.isnan(y)
    data = y[valid_mask]
    n = len(data)

    if n < 2:
        val = float(data[0]) if n == 1 else 0.0
        return {"slope": 0.0, "intercept": val, "ci_lower": 0.0, "ci_upper": 0.0}

    if time_steps is None:
        t = np.arange(len(y), dtype=float)[valid_mask]
    else:
        t = np.asarray(time_steps, dtype=float)[valid_mask]

    # Pairwise slopes (y[j] - y[i]) / (t[j] - t[i]) for j > i
    dt = t[None, :] - t[:, None]
    dy = data[None, :] - data[:, None]
    
    iu = np.triu_indices(n, k=1)
    valid_pairs = dt[iu] != 0
    raw_slopes = dy[iu][valid_pairs] / dt[iu][valid_pairs]
    slopes = np.sort(raw_slopes)
    n_prime = len(slopes)

    median_slope = float(np.median(slopes)) if n_prime > 0 else 0.0
    intercept = float(np.median(data - median_slope * t))

    # Gilbert (1987) non-parametric confidence interval for slope
    if n_prime > 2:
        if var_s is None or var_s <= 0:
            var_s_calc = (n * (n - 1) * (2 * n + 5)) / 18.0
        else:
            var_s_calc = var_s

        z_crit = float(stats.norm.ppf(1.0 - alpha / 2.0))
        c_alpha = z_crit * np.sqrt(var_s_calc)

        m1 = int(np.floor((n_prime - c_alpha) / 2.0))
        m2 = int(np.ceil((n_prime + c_alpha) / 2.0))

        idx_lower = max(0, min(n_prime - 1, m1))
        idx_upper = max(0, min(n_prime - 1, m2))

        ci_lower = float(slopes[idx_lower])
        ci_upper = float(slopes[idx_upper])
    else:
        ci_lower = median_slope
        ci_upper = median_slope

    return {
        "slope": median_slope,
        "intercept": intercept,
        "ci_lower": ci_lower,
        "ci_upper": ci_upper
    }


def benjamini_hochberg_fdr(
    p_values: np.ndarray,
    alpha: float = 0.05
) -> tuple[np.ndarray, np.ndarray]:
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
    time_coords: np.ndarray | None = None,
    alpha: float = 0.05
) -> dict[str, np.ndarray]:
    """
    Compute spatial trends across a 3D grid [time, lat, lon].
    Utilizes multi-threaded parallel chunk execution across rows for high performance.
    
    Parameters:
        data_3d: 3D array of shape (T, H, W).
        time_coords: Optional 1D array of time steps of length T.
        alpha: Significance threshold.
        
    Returns:
        Dict with 2D spatial maps:
          'slopes', 'intercepts', 'p_values', 'q_values',
          'is_significant_raw', 'is_significant_fdr', 'n_samples'
    """
    import os
    from concurrent.futures import ThreadPoolExecutor

    _t_len, h_len, w_len = data_3d.shape
    
    slopes = np.zeros((h_len, w_len), dtype=float)
    intercepts = np.zeros((h_len, w_len), dtype=float)
    ci_lower = np.zeros((h_len, w_len), dtype=float)
    ci_upper = np.zeros((h_len, w_len), dtype=float)
    p_values = np.ones((h_len, w_len), dtype=float)
    n_samples = np.zeros((h_len, w_len), dtype=int)
    
    def process_row(i: int):
        row_slopes = np.zeros(w_len, dtype=float)
        row_intercepts = np.zeros(w_len, dtype=float)
        row_ci_l = np.zeros(w_len, dtype=float)
        row_ci_u = np.zeros(w_len, dtype=float)
        row_p_vals = np.ones(w_len, dtype=float)
        row_samples = np.zeros(w_len, dtype=int)

        for j in range(w_len):
            ts = data_3d[:, i, j]
            mk_res = mann_kendall_test(ts, alpha=alpha, correct_autocorrelation=True)
            row_p_vals[j] = mk_res["p_value"]
            row_samples[j] = mk_res["n_samples"]

            sen_res = sens_slope(ts, time_steps=time_coords, alpha=alpha, var_s=mk_res["var_s"])
            row_slopes[j] = sen_res["slope"]
            row_intercepts[j] = sen_res["intercept"]
            row_ci_l[j] = sen_res["ci_lower"]
            row_ci_u[j] = sen_res["ci_upper"]

        return i, row_slopes, row_intercepts, row_ci_l, row_ci_u, row_p_vals, row_samples

    total_cells = h_len * w_len
    if total_cells >= 30:
        max_workers = min(8, max(2, os.cpu_count() or 4))
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            for i, r_slopes, r_intercepts, r_ci_l, r_ci_u, r_p, r_samples in executor.map(process_row, range(h_len)):
                slopes[i, :] = r_slopes
                intercepts[i, :] = r_intercepts
                ci_lower[i, :] = r_ci_l
                ci_upper[i, :] = r_ci_u
                p_values[i, :] = r_p
                n_samples[i, :] = r_samples
    else:
        for i in range(h_len):
            _, r_slopes, r_intercepts, r_ci_l, r_ci_u, r_p, r_samples = process_row(i)
            slopes[i, :] = r_slopes
            intercepts[i, :] = r_intercepts
            ci_lower[i, :] = r_ci_l
            ci_upper[i, :] = r_ci_u
            p_values[i, :] = r_p
            n_samples[i, :] = r_samples

    # Benjamini-Hochberg adjustment across the entire 2D spatial field
    q_values, is_sig_fdr = benjamini_hochberg_fdr(p_values, alpha=alpha)
    is_sig_raw = p_values < alpha

    # Spatial Autocorrelation: Global Moran's I & Anselin Local Moran's I (LISA)
    try:
        from app.science.spatial import compute_global_morans_i, compute_lisa_clusters
        moran_stats = compute_global_morans_i(slopes)
        lisa_clusters, _ = compute_lisa_clusters(slopes, p_values, alpha=alpha)
    except Exception:
        moran_stats = {"moran_i": 0.0, "p_value": 1.0, "is_clustered": False}
        lisa_clusters = np.full((h_len, w_len), "NS", dtype=object)

    return {
        "slopes": slopes,
        "intercepts": intercepts,
        "ci_lower": ci_lower,
        "ci_upper": ci_upper,
        "p_values": p_values,
        "q_values": q_values,
        "is_significant_raw": is_sig_raw,
        "is_significant_fdr": is_sig_fdr,
        "n_samples": n_samples,
        "moran_stats": moran_stats,
        "lisa_clusters": lisa_clusters,
    }


def pettitt_changepoint_test(
    y: np.ndarray,
    time_coords: np.ndarray | None = None,
    alpha: float = 0.05
) -> dict[str, Any]:
    """
    Pettitt's (1979) non-parametric test for detecting a single abrupt regime changepoint
    in a continuous climate time series.
    
    Formula:
        U_t = 2 * W_t - t * (n + 1)
        where W_t = sum(rank(y[1..t]))
        K = max_{1 <= t < n} |U_t|
        p ~= 2 * exp(-6 * K^2 / (n^3 + n^2))
    """
    valid_mask = ~np.isnan(y)
    data = y[valid_mask]
    n = len(data)

    if n < 6:
        return {
            "changepoint_index": None,
            "changepoint_time": None,
            "k_statistic": 0.0,
            "p_value": 1.0,
            "significant": False
        }

    times = time_coords[valid_mask] if time_coords is not None else np.arange(n)

    # Compute ranks
    ranks = stats.rankdata(data)
    
    # Cumulative rank sum W_t
    w = np.cumsum(ranks)
    t = np.arange(1, n + 1)
    
    # U_t for 1 <= t < n
    u = 2.0 * w[:-1] - t[:-1] * (n + 1)
    abs_u = np.abs(u)
    
    tau_idx = int(np.argmax(abs_u))
    k_stat = float(abs_u[tau_idx])
    
    # Asymptotic p-value approximation (Pettitt 1979)
    p_val = float(2.0 * np.exp(-6.0 * (k_stat ** 2) / (n ** 3 + n ** 2)))
    p_val = min(1.0, max(0.0, p_val))
    
    cp_time = times[tau_idx] if tau_idx < len(times) else None
    
    formatted_cp_time = None
    if cp_time is not None:
        try:
            formatted_cp_time = int(cp_time)
        except (ValueError, TypeError):
            formatted_cp_time = str(cp_time)

    return {
        "changepoint_index": tau_idx,
        "changepoint_time": formatted_cp_time,
        "k_statistic": round(k_stat, 2),
        "p_value": round(p_val, 5),
        "significant": bool(p_val < alpha)
    }

