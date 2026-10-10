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

import pytest
import numpy as np
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
