"""
Test Phase 6 Scientific Instrument capabilities:
1. Gilbert (1987) 95% Confidence Intervals
2. Anselin Local Moran's I (LISA) & Global Moran's I
3. CF-1.8 NetCDF-4 export endpoint
4. GeoJSON FeatureCollection export endpoint
5. NASA Climate Science Dossier generation endpoint
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_export_netcdf_geojson_and_dossier():
    """Verify analysis run produces valid NetCDF, GeoJSON, and Dossier exports."""
    # 1. Run analysis on NASA POWER dataset (within fixture bbox)
    res = client.post(
        "/analysis",
        json={
            "dataset_id": "nasa_power",
            "variable_id": "T2M",
            "start_year": 2000,
            "end_year": 2023,
            "bbox": [-101.0, 31.0, -95.0, 37.0],
            "alpha": 0.05
        }
    )
    assert res.status_code == 200
    data = res.json()
    analysis_id = data["analysis_id"]

    # Check summary contains spatial autocorrelation
    assert "spatial_autocorrelation" in data["summary"]
    sa = data["summary"]["spatial_autocorrelation"]
    assert "moran_i" in sa
    assert "z_score" in sa
    assert "p_value" in sa
    assert "interpretation" in sa

    # Check grid contains ci_lower, ci_upper, lisa_cluster
    assert len(data["grid"]) > 0
    first_cell = data["grid"][0]
    assert "ci_lower" in first_cell
    assert "ci_upper" in first_cell
    assert "lisa_cluster" in first_cell
    assert first_cell["ci_lower"] <= first_cell["ci_upper"]
    assert first_cell["lisa_cluster"] in {"HH", "LL", "HL", "LH", "NS"}

    # 2. Test GET /analysis/{id}/export/netcdf
    nc_res = client.get(f"/analysis/{analysis_id}/export/netcdf")
    assert nc_res.status_code == 200
    assert nc_res.headers.get("content-type") == "application/x-netcdf"
    assert len(nc_res.content) > 500  # Valid NetCDF binary payload

    # 3. Test GET /analysis/{id}/export/geojson
    geo_res = client.get(f"/analysis/{analysis_id}/export/geojson")
    assert geo_res.status_code == 200
    assert geo_res.headers.get("content-type") == "application/geo+json"
    geojson = geo_res.json()
    assert geojson["type"] == "FeatureCollection"
    assert len(geojson["features"]) > 0
    feat = geojson["features"][0]
    assert feat["type"] == "Feature"
    assert feat["geometry"]["type"] == "Point"
    assert "slope" in feat["properties"]
    assert "ci_lower" in feat["properties"]
    assert "ci_upper" in feat["properties"]
    assert "lisa_cluster" in feat["properties"]

    # 4. Test GET /analysis/{id}/dossier
    dossier_res = client.get(f"/analysis/{analysis_id}/dossier")
    assert dossier_res.status_code == 200
    assert "text/markdown" in dossier_res.headers.get("content-type")
    dossier_md = dossier_res.text
    assert "NASA Earth Science Briefing & Empirical Dossier" in dossier_md
    assert "Gilbert (1987)" in dossier_md
    assert "Moran's I" in dossier_md
    assert "Anselin LISA" in dossier_md
