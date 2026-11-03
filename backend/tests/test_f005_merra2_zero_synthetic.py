"""
Tests for F-005: MERRA-2 Synthetic Generator Elimination and Zero-Synthetic Standard.
Verifies that missing observational NetCDF granules trigger an explicit HTTP 503 error
rather than silently generating synthetic random trends via np.random.RandomState.
"""
import pytest
from fastapi import HTTPException

from app.adapters.merra2 import MERRA2Adapter


def test_missing_merra2_granule_raises_503_in_live_mode(tmp_path, monkeypatch):
    """Verify that when authentic NetCDF granule is missing, adapter raises 503 instead of synthetic data."""
    # Point MERRA2_DATA_DIR to an empty directory to simulate missing NetCDF files
    monkeypatch.setenv("MERRA2_DATA_DIR", str(tmp_path))
    adapter = MERRA2Adapter()
    with pytest.raises(HTTPException) as exc_info:
        adapter.fetch(
            variable="T2M",
            start_year=2000,
            end_year=2020,
            bbox=[-100.0, 30.0, -90.0, 40.0],
            prefer_live=True
        )
    assert exc_info.value.status_code == 503
    assert "Zero-Synthetic Standard" in exc_info.value.detail or "unavailable" in exc_info.value.detail


def test_production_environment_blocks_synthetic_even_with_prefer_live_false(monkeypatch):
    """In production mode (ENVIRONMENT=production), synthetic generation is unconditionally rejected with 503."""
    monkeypatch.setenv("ENVIRONMENT", "production")
    adapter = MERRA2Adapter()

    with pytest.raises(HTTPException) as exc_info:
        adapter.fetch(
            variable="T2M",
            start_year=2000,
            end_year=2020,
            bbox=[-100.0, 30.0, -90.0, 40.0],
            prefer_live=False
        )
    assert exc_info.value.status_code == 503
    assert "Synthetic data generation is strictly prohibited" in exc_info.value.detail


def test_authentic_netcdf_loads_with_zero_synthetic_flag():
    """Verify authentic NetCDF fixture loads with is_synthetic: False."""
    adapter = MERRA2Adapter()
    res = adapter.fetch(
        variable="T2M",
        start_year=2000,
        end_year=2020,
        bbox=[-100.0, 30.0, -90.0, 40.0],
        prefer_live=True
    )
    assert res["is_synthetic"] is False
    assert res["provenance"]["is_synthetic"] is False
    assert "NASA GMAO MERRA-2" in res["data_source_label"]
