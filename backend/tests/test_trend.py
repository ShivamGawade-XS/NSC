"""
Unit tests for EarthSift Scientific Trend Engine.
Mathematically verifies Mann-Kendall, Sen's Slope, and Benjamini-Hochberg FDR.
"""

import numpy as np
import pytest
from app.science.trend import (
    mann_kendall_test,
    sens_slope,
    benjamini_hochberg_fdr,
    compute_spatial_trends
)


def test_mann_kendall_increasing():
    """Verify strictly increasing series yields positive S, high significance, and increasing direction."""
    t = np.arange(20, dtype=float)
    y = 2.0 * t + 5.0
    res = mann_kendall_test(y, alpha=0.05)
    
    assert res["s"] > 0
    assert res["p_value"] < 0.001
    assert res["significant"] is True
    assert res["direction"] == "increasing"
    assert res["tau"] == 1.0


def test_mann_kendall_decreasing():
    """Verify strictly decreasing series yields negative S, high significance, and decreasing direction."""
    t = np.arange(25, dtype=float)
    y = -1.5 * t + 100.0
    res = mann_kendall_test(y, alpha=0.05)
    
    assert res["s"] < 0
    assert res["p_value"] < 0.001
    assert res["significant"] is True
    assert res["direction"] == "decreasing"
    assert res["tau"] == -1.0


def test_mann_kendall_random_noise():
    """Verify random white noise without trend yields non-significant result."""
    np.random.seed(0)
    y = np.random.normal(loc=10.0, scale=1.0, size=30)
    res = mann_kendall_test(y, alpha=0.05)
    
    assert res["significant"] is False
    assert res["direction"] == "no_trend"


def test_mann_kendall_ties_handling():
    """Verify tie adjustment when multiple identical values exist."""
    y = np.array([1.0, 2.0, 2.0, 2.0, 3.0, 4.0, 4.0, 5.0, 6.0, 6.0])
    res = mann_kendall_test(y, alpha=0.05)
    
    assert res["s"] > 0
    assert res["var_s"] > 0
    assert res["significant"] is True


def test_mann_kendall_nan_handling():
    """Verify NaNs are filtered out without crashing."""
    y = np.array([np.nan, 1.0, 2.0, np.nan, 3.0, 4.0, 5.0, 6.0, np.nan])
    res = mann_kendall_test(y, alpha=0.05)
    
    assert res["n_samples"] == 6
    assert res["significant"] is True
    assert res["direction"] == "increasing"


def test_mann_kendall_insufficient_samples():
    """Verify series with fewer than 5 samples returns unverified default."""
    y = np.array([1.0, 2.0, 3.0])
    res = mann_kendall_test(y)
    
    assert res["p_value"] == 1.0
    assert res["significant"] is False
    assert res["direction"] == "no_trend"


def test_sens_slope_accuracy():
    """Verify Sen's slope recovers known linear slope with outliers."""
    np.random.seed(123)
    t = np.arange(30, dtype=float)
    # Ground truth slope = 0.75
    y = 0.75 * t + 10.0
    # Add an extreme outlier that would distort standard OLS
    y[10] = 500.0
    
    res = sens_slope(y, time_steps=t)
    assert pytest.approx(res["slope"], rel=1e-2) == 0.75
    assert pytest.approx(res["intercept"], rel=1e-2) == 10.0


def test_benjamini_hochberg_fdr():
    """Verify Benjamini-Hochberg correctly controls false discovery rate."""
    # 10 tests: 3 strong true positives, 7 random nulls
    p_vals = np.array([0.001, 0.004, 0.012, 0.15, 0.22, 0.45, 0.60, 0.75, 0.88, 0.95])
    q_vals, sig_flags = benjamini_hochberg_fdr(p_vals, alpha=0.05)
    
    # First 3 should remain significant under FDR
    assert bool(sig_flags[0]) is True
    assert bool(sig_flags[1]) is True
    assert bool(sig_flags[2]) is True
    # Insignificant tests should remain False
    assert np.all(sig_flags[3:] == False)
    # Adjusted q-values must be non-decreasing
    assert np.all(np.diff(q_vals) >= 0)


def test_compute_spatial_trends():
    """Verify 3D grid analysis correctly computes spatial trend layers."""
    time_len = 15
    lat_len = 3
    lon_len = 4
    
    data = np.zeros((time_len, lat_len, lon_len), dtype=float)
    # Make cell (0, 0) strongly increasing
    for t in range(time_len):
        data[t, 0, 0] = 1.5 * t
        # Make cell (1, 1) strongly decreasing
        data[t, 1, 1] = -2.0 * t
    
    res = compute_spatial_trends(data, alpha=0.05)
    
    assert res["slopes"].shape == (lat_len, lon_len)
    assert res["p_values"].shape == (lat_len, lon_len)
    assert res["q_values"].shape == (lat_len, lon_len)
    
    # Cell (0, 0)
    assert res["slopes"][0, 0] > 1.0
    assert bool(res["is_significant_raw"][0, 0]) is True
    
    # Cell (1, 1)
    assert res["slopes"][1, 1] < -1.0
    assert bool(res["is_significant_raw"][1, 1]) is True
    
    # Cell (2, 2) which was all zeros
    assert res["slopes"][2, 2] == 0.0
    assert bool(res["is_significant_raw"][2, 2]) is False
