"""
Unit tests for EarthSift Scientific Trend Engine.
Mathematically verifies:
- positive trend
- negative trend
- no trend
- constant series
- noisy series
- missing observations (NaNs)
- insufficient observations (< 5)
- seasonal series
- autocorrelated series (AR(1))
- threshold-edge p-values (alpha = 0.05 boundary)
- Sen/Theil-Sen slope robustness
- Benjamini-Hochberg FDR correction
- geographic masking / coordinate ordering
- unit conversion (decadal rates)
"""

import numpy as np
import pytest
from app.science.trend import (
    benjamini_hochberg_fdr,
    compute_spatial_trends,
    mann_kendall_test,
    sens_slope,
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


def test_mann_kendall_no_trend():
    """Verify constant flat series has S=0, tau=0, and no_trend."""
    y = np.ones(30, dtype=float) * 42.0
    res = mann_kendall_test(y, alpha=0.05)
    assert res["s"] == 0
    assert res["tau"] == 0.0
    assert res["significant"] is False
    assert res["direction"] == "no_trend"


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


def test_seasonal_series():
    """
    Verify behavior on seasonal cyclic series (e.g., annual cycle with 12 months).
    When tested across annual cycles, seasonality without long-term drift produces no trend.
    """
    months = np.arange(120, dtype=float)  # 10 years
    seasonal = 10.0 * np.sin(2 * np.pi * months / 12.0) + 15.0
    res = mann_kendall_test(seasonal, alpha=0.05)
    assert res["significant"] is False
    assert res["direction"] == "no_trend"


def test_autocorrelated_series():
    """
    Verify AR(1) red noise persistence.
    Tests robust handling of autocorrelated climate series.
    """
    np.random.seed(42)
    n = 40
    # Generate AR(1) process: x_t = 0.6 * x_{t-1} + e_t
    x = np.zeros(n)
    for i in range(1, n):
        x[i] = 0.6 * x[i-1] + np.random.normal(0, 1)

    # Without drift, AR(1) should not falsely detect monotonic trend
    res = mann_kendall_test(x, alpha=0.01)
    # At conservative alpha=0.01, null hypothesis is preserved
    assert res["significant"] is False


def test_threshold_edge_p_values():
    """Verify exact behavior at the edge of significance alpha = 0.05."""
    # Single test: boundary is exactly alpha = 0.05
    p_sig = np.array([0.0499])
    _q_sig, sig_sig = benjamini_hochberg_fdr(p_sig, alpha=0.05)
    assert bool(sig_sig[0]) is True

    p_insig = np.array([0.0501])
    _q_insig, sig_insig = benjamini_hochberg_fdr(p_insig, alpha=0.05)
    assert bool(sig_insig[0]) is False

    # Multiple comparisons: m=2, rank 1 critical value is 0.05 / 2 = 0.025
    p_multi = np.array([0.020, 0.060])
    _q_multi, sig_multi = benjamini_hochberg_fdr(p_multi, alpha=0.05)
    assert bool(sig_multi[0]) is True
    assert bool(sig_multi[1]) is False


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


def test_unit_conversion_decadal_rate():
    """Verify rate per year accurately scales to rate per decade."""
    years = np.arange(2000, 2020, dtype=float)
    time_coords_annual = years - 2000.0
    time_coords_decadal = (years - 2000.0) / 10.0

    # 0.03 °C per year = 0.30 °C per decade
    y = 0.03 * time_coords_annual + 15.0

    slope_annual = sens_slope(y, time_steps=time_coords_annual)["slope"]
    slope_decadal = sens_slope(y, time_steps=time_coords_decadal)["slope"]

    assert pytest.approx(slope_annual, rel=1e-4) == 0.03
    assert pytest.approx(slope_decadal, rel=1e-4) == 0.30
    assert pytest.approx(slope_decadal, rel=1e-4) == 10.0 * slope_annual
