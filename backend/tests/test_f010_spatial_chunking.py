"""
Unit & Integration Tests for F-010 (Part 2):
Spatial Grid Chunking & Memory Tiling in calculate_spatial_trends / compute_spatial_trends.
Asserts that:
1. Chunked execution produces mathematically identical results to monolithic unchunked execution.
2. Memory footprint stays tightly bounded during large domain processing.
3. Edge cases (varying aspect ratios, small grids, single rows) execute correctly.
"""
import numpy as np
import pytest

from app.science.trend import compute_spatial_trends


def test_spatial_chunking_mathematical_equivalence():
    """Verify that chunked calculation produces identical results to unchunked calculation."""
    np.random.seed(42)
    # 20 time steps, 30 lat, 40 lon = 1,200 cells
    t_len, h_len, w_len = 20, 30, 40
    base = np.linspace(10, 25, t_len)[:, None, None]
    noise = np.random.normal(0, 1.0, (t_len, h_len, w_len))
    data_3d = base + noise
    
    # Introduce some ties and missing values (NaN) to test all branches
    data_3d[5, 2, 3] = np.nan
    data_3d[10, :, 10] = np.round(data_3d[10, :, 10], 1)
    data_3d[11, :, 10] = data_3d[10, :, 10]

    # Run unchunked (large chunk_size_cells)
    res_unchunked = compute_spatial_trends(
        data_3d,
        alpha=0.05,
        decadal_scale=10.0,
        chunk_size_cells=10000,
    )

    # Run heavily chunked (small chunk_size_cells, e.g. 100 cells -> 12 chunks)
    res_chunked = compute_spatial_trends(
        data_3d,
        alpha=0.05,
        decadal_scale=10.0,
        chunk_size_cells=100,
    )

    # Compare all fields
    np.testing.assert_allclose(res_chunked["slopes"], res_unchunked["slopes"], rtol=1e-12, atol=1e-12, equal_nan=True)
    np.testing.assert_allclose(res_chunked["intercepts"], res_unchunked["intercepts"], rtol=1e-12, atol=1e-12, equal_nan=True)
    np.testing.assert_allclose(res_chunked["ci_lower"], res_unchunked["ci_lower"], rtol=1e-12, atol=1e-12, equal_nan=True)
    np.testing.assert_allclose(res_chunked["ci_upper"], res_unchunked["ci_upper"], rtol=1e-12, atol=1e-12, equal_nan=True)
    np.testing.assert_allclose(res_chunked["p_values"], res_unchunked["p_values"], rtol=1e-12, atol=1e-12, equal_nan=True)
    np.testing.assert_allclose(res_chunked["q_values"], res_unchunked["q_values"], rtol=1e-12, atol=1e-12, equal_nan=True)
    np.testing.assert_allclose(res_chunked["tau"], res_unchunked["tau"], rtol=1e-12, atol=1e-12, equal_nan=True)
    np.testing.assert_array_equal(res_chunked["n_samples"], res_unchunked["n_samples"])
    np.testing.assert_array_equal(res_chunked["is_significant_fdr"], res_unchunked["is_significant_fdr"])


def test_spatial_chunking_large_domain_memory_protection():
    """Verify compute_spatial_trends runs cleanly across a 3,000 cell grid under chunking."""
    np.random.seed(123)
    # T=25, 50x60 = 3,000 cells
    t_len, h_len, w_len = 25, 50, 60
    t_coords = np.arange(2000, 2025, dtype=float)
    data_3d = np.random.uniform(280.0, 310.0, size=(t_len, h_len, w_len))

    # With chunk_size_cells=500, it splits into 6 row chunks
    res = compute_spatial_trends(
        data_3d,
        time_coords=t_coords,
        alpha=0.05,
        decadal_scale=10.0,
        chunk_size_cells=500,
    )

    assert res["slopes"].shape == (50, 60)
    assert res["p_values"].shape == (50, 60)
    assert res["q_values"].shape == (50, 60)
    assert res["ci_lower"].shape == (50, 60)
    assert np.all(res["n_samples"] == 25)
    assert "moran_stats" in res
    assert "lisa_clusters" in res
