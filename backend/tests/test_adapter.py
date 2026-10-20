"""
EarthSift — Tests for Dataset Adapter & NASA Data Pipeline
Tests DatasetAdapter contract:
- discover()
- metadata()
- validate()
- fetch()
- subset()
- normalize()
- synthetic data labeling
"""

import numpy as np
import pytest
from app.adapters.merra2 import MERRA2Adapter


def test_merra2_metadata():
    adapter = MERRA2Adapter()
    meta = adapter.metadata()
    assert meta["dataset_id"] == "merra2_reanalysis"
    assert "T2M" in meta["variables"]
    assert "PRECTOT" in meta["variables"]
    assert meta["temporal_range"] == [1980, 2024]
    assert "doi" in meta


def test_merra2_discover():
    adapter = MERRA2Adapter()
    results = adapter.discover(query="T2M")
    assert len(results) >= 1
    assert results[0]["variable"] == "T2M"


def test_merra2_validation_invalid_variable():
    adapter = MERRA2Adapter()
    with pytest.raises(ValueError, match="Unsupported variable 'INVALID'"):
        adapter.validate(variable="INVALID", start_year=2000, end_year=2020)


def test_merra2_validation_inverted_years():
    adapter = MERRA2Adapter()
    with pytest.raises(ValueError, match="strictly greater than start year"):
        adapter.validate(variable="T2M", start_year=2020, end_year=2000)


def test_merra2_validation_insufficient_sample():
    adapter = MERRA2Adapter()
    with pytest.raises(ValueError, match="Insufficient sample window"):
        adapter.validate(variable="T2M", start_year=2020, end_year=2022)


def test_merra2_validation_invalid_bbox():
    adapter = MERRA2Adapter()
    # Invalid lat ordering (min_lat > max_lat)
    with pytest.raises(ValueError, match="Invalid latitude bounds"):
        adapter.validate(variable="T2M", start_year=2000, end_year=2020, bbox=[-100, 50, -80, 30])


def test_merra2_fetch_and_synthetic_labeling():
    adapter = MERRA2Adapter()
    data = adapter.fetch(variable="T2M", start_year=2005, end_year=2015, prefer_live=False)
    
    assert data["is_synthetic"] is True
    assert "Synthetic test data" in data["data_source_label"]
    assert data["provenance"]["is_synthetic"] is True
    assert "Synthetic test data" in data["provenance"]["data_source_label"]
    assert data["data"].shape[0] == 11  # 2005 to 2015 inclusive


def test_merra2_subset_and_normalize():
    adapter = MERRA2Adapter()
    raw = adapter.fetch(variable="T2M", start_year=2000, end_year=2010, bbox=[-120.0, 30.0, -80.0, 48.0], prefer_live=False)
    sub = adapter.subset(raw, bbox=[-110.0, 32.0, -90.0, 42.0])
    norm = adapter.normalize(sub)

    # Check coordinate ordering
    lats = norm["lat"]
    lons = norm["lon"]
    assert np.all(np.diff(lats) > 0), "Latitudes must be strictly ascending"
    assert np.all(np.diff(lons) > 0), "Longitudes must be strictly ascending"
    assert np.min(lats) >= 32.0
    assert np.max(lats) <= 42.0
    assert np.min(lons) >= -110.0
    assert np.max(lons) <= -90.0


def test_merra2_fetch_subset_pipeline():
    adapter = MERRA2Adapter()
    res = adapter.fetch_subset(variable="PRECTOT", start_year=2000, end_year=2020, bbox=[-100.0, 30.0, -80.0, 40.0], prefer_live=False)
    assert "data" in res
    assert res["variable_id"] == "PRECTOT"
    assert res["display_units"] == "mm / day"
    assert res["is_synthetic"] is True


def test_merra2_real_netcdf_ingestion():
    """Verify authentic NASA NetCDF dataset is ingested, sliced, and verified via NASAPowerAdapter."""
    from app.adapters.nasa_power import NASAPowerAdapter
    adapter = NASAPowerAdapter()
    # Bbox within the bundled authentic NASA fixture coverage (Texas/Southern Plains)
    res = adapter.fetch(variable="T2M", start_year=2000, end_year=2020,
                        bbox=[-101.0, 31.0, -95.0, 37.0], prefer_live=False)
    assert "data" in res
    assert res["variable_id"] == "T2M"
    assert res["is_synthetic"] is False
    assert "NASA" in res["data_source_label"]
    assert res["data"].shape[0] == 21       # 21 years inclusive
    assert np.all(np.diff(res["lat"]) > 0)  # latitudes ascending
    assert np.all(np.diff(res["lon"]) > 0)  # longitudes ascending
    # Verify physically plausible temperatures (Texas: 17–22 °C annual mean)
    assert float(res["data"].mean()) > 10.0
    assert float(res["data"].mean()) < 35.0


def test_nasa_power_adapter_live_metadata():
    """Verify NASAPowerAdapter metadata and catalog are correct."""
    from app.adapters.nasa_power import NASAPowerAdapter
    adapter = NASAPowerAdapter()
    meta = adapter.metadata()
    assert meta["is_synthetic"] is False if "is_synthetic" in meta else True
    assert "T2M" in meta["variables"]
    assert "PRECTOT" in meta["variables"]
    assert meta["doi"] == "10.5067/POWER/10.0.0"
    catalog = adapter.discover()
    assert len(catalog) > 0
    assert all("is_synthetic" in c for c in catalog)
    assert all(c["is_synthetic"] is False for c in catalog)


def test_merra2_adapter_prefer_live_and_unit_conversions():
    """Verify MERRA2Adapter respects prefer_live and prevents unit double-conversion."""
    from app.adapters.merra2 import MERRA2Adapter
    adapter = MERRA2Adapter()

    # 1. prefer_live=False deterministically returns synthetic fixture
    syn_res = adapter.fetch(variable="T2M", start_year=2000, end_year=2020, prefer_live=False)
    assert syn_res["is_synthetic"] is True
    assert syn_res["data_source_label"] == "Synthetic test data — not NASA observations."

    # 2. prefer_live=True loads authentic NetCDF fixture without double conversion
    real_res = adapter.fetch(variable="T2M", start_year=2000, end_year=2020,
                             bbox=[-100.0, 30.0, -90.0, 40.0], prefer_live=True)
    assert real_res["is_synthetic"] is False
    assert "NASA GMAO MERRA-2" in real_res["data_source_label"]
    # Check reasonable Celsius temperatures (~5 to 30 °C, not negative Kelvin offset)
    mean_val = float(np.nanmean(real_res["data"]))
    assert 5.0 < mean_val < 35.0

    # 3. PRECTOT with prefer_live=True loads mm/day without double conversion (~0.5 to 10 mm/day)
    precip_res = adapter.fetch(variable="PRECTOT", start_year=2000, end_year=2020,
                               bbox=[-100.0, 30.0, -90.0, 40.0], prefer_live=True)
    assert precip_res["is_synthetic"] is False
    precip_mean = float(np.nanmean(precip_res["data"]))
    assert 0.1 < precip_mean < 25.0


def test_nasa_power_live_retry_and_timeout():
    """Verify live HTTP calls retry on 429/503 with exponential backoff and timeout=12.0."""
    import urllib.error
    from unittest.mock import MagicMock, patch
    from app.adapters.nasa_power import NASAPowerAdapter

    adapter = NASAPowerAdapter()
    attempts = 0

    def mock_urlopen(req, timeout):
        nonlocal attempts
        attempts += 1
        assert timeout == 12.0
        if attempts == 1:
            raise urllib.error.HTTPError(req.full_url, 429, "Too Many Requests", {}, None)
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = b"authentic_nasa_netcdf_data" * 100
        mock_resp.__enter__.return_value = mock_resp
        mock_resp.__exit__.return_value = None
        return mock_resp

    with patch("urllib.request.urlopen", side_effect=mock_urlopen):
        with patch("time.sleep", return_value=None) as mock_sleep:
            with patch("builtins.open", MagicMock()):
                with patch("pathlib.Path.exists", return_value=False):
                    res = adapter.fetch_live_granule("T2M", 2000, 2020, [-100.0, 30.0, -95.0, 35.0])
                    assert res is not None
                    assert attempts == 2
                    mock_sleep.assert_called_once_with(1.0)


