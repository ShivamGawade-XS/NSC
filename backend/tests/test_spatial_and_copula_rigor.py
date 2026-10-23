"""
Unit tests validating spatial autocorrelation, LISA clustering, bivariate copula hazard,
and climate velocity dimensional consistency and robustness.
"""

import numpy as np

from app.science.climate_velocity import compute_climate_velocity
from app.science.copula_hazard import fit_bivariate_copula
from app.science.spatial import compute_global_morans_i, compute_lisa_clusters


def test_morans_i_checkerboard_negative_autocorrelation():
    """Construct an alternating 8x8 checkerboard grid and assert strong negative spatial autocorrelation."""
    i, j = np.indices((8, 8))
    grid = ((-1.0) ** (i + j)).astype(float)

    res = compute_global_morans_i(grid)

    assert res["moran_i"] < -0.5, f"Expected moran_i < -0.5, got {res['moran_i']}"
    assert res["z_score"] < -3.0, f"Expected z_score < -3.0, got {res['z_score']}"
    assert res["p_value"] < 0.01, f"Expected p_value < 0.01, got {res['p_value']}"
    assert "negative spatial dispersion" in res["interpretation"], (
        f"Expected 'negative spatial dispersion' in interpretation, got {res['interpretation']}"
    )


def test_morans_i_with_coastal_nan_asymmetry():
    """Mask 40% of a gradient grid with np.nan and verify S1, S2, positive finite variance var_i > 0, and p < 0.01."""
    rng = np.random.default_rng(42)
    i, j = np.indices((12, 12))
    # Distinct spatial gradient to assure strong spatial autocorrelation
    grid = (2.0 * i + 3.0 * j).astype(float)

    # Mask 40% of cells with np.nan (creating highly asymmetric neighbor counts N_i != N_j)
    nan_mask = rng.random((12, 12)) < 0.40
    grid[nan_mask] = np.nan

    res = compute_global_morans_i(grid)

    assert res["s1"] > 0.0, f"Expected positive S1, got {res['s1']}"
    assert res["s2"] > 0.0, f"Expected positive S2, got {res['s2']}"
    assert res["var_i"] > 0.0, f"Expected var_i > 0, got {res['var_i']}"
    assert np.isfinite(res["var_i"]), f"Expected finite var_i, got {res['var_i']}"
    assert res["p_value"] < 0.01, f"Expected p_value < 0.01, got {res['p_value']}"


def test_lisa_clusters_null_random_noise_returns_ns():
    """Pass uniform random noise with p_values_2d=None and assert >= 85% of cells are classified as 'NS'."""
    rng = np.random.default_rng(1337)
    grid = rng.uniform(0.0, 1.0, (20, 20))

    clusters, local_i = compute_lisa_clusters(grid, p_values_2d=None, alpha=0.05)

    ns_ratio = float(np.mean(clusters == "NS"))
    assert ns_ratio >= 0.85, (
        f"Expected >= 85% of cells to be classified as 'NS' under null random noise, got {ns_ratio:.2%}"
    )


def test_copula_negative_tau_returns_independence():
    """Pass strongly negatively correlated arrays and assert independence fallback (theta=1.0, tail_dependence=0.0)."""
    x = np.linspace(0.0, 10.0, 30)
    y = -x

    res = fit_bivariate_copula(x, y, copula_type="gumbel")

    assert res["tau"] < -0.9, f"Expected tau < -0.9, got {res['tau']}"
    assert res["theta"] == 1.0, f"Expected theta == 1.0, got {res['theta']}"
    assert res["tail_dependence"] == 0.0, f"Expected tail_dependence == 0.0, got {res['tail_dependence']}"


def test_climate_velocity_dimensional_consistency_without_climatology():
    """Verify compute_climate_velocity with uniform slopes and mean_climatology=None produces finite, non-zero velocities."""
    slopes = np.full((10, 10), 0.3)
    lats = np.linspace(30.0, 40.0, 10)
    lons = np.linspace(-105.0, -95.0, 10)

    res = compute_climate_velocity(slopes, lats, lons, mean_climatology=None)
    velocity_mag = res["velocity_magnitude"]

    assert np.all(np.isfinite(velocity_mag)), "Expected all velocity magnitude elements to be finite."
    assert np.all(velocity_mag > 0.0), "Expected all velocity magnitude elements to be strictly positive."
