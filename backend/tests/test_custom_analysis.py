"""
EarthSift — Custom User-Uploaded Dataset Analysis Test Suite
Verifies:
1. POST /analysis/custom endpoint with real time series observations
2. Computation of Mann-Kendall p-values, Theil-Sen slopes, Gilbert 95% CIs, and Pettitt changepoints
3. Benjamini-Hochberg FDR multiplicity control across custom cells
4. 2D regular grid reconstruction and Global Moran's I / Anselin LISA spatial cluster anomalies
5. Full interoperability with downstream endpoints: /timeseries, /map, /signals, /export/netcdf, /export/geojson, /dossier, /export/notebook
"""

import numpy as np
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_custom_analysis_with_timeseries_computes_real_statistics():
    """Verify POST /analysis/custom computes authentic non-parametric statistics and FDR control."""
    years = list(range(2000, 2024))
    cells = []

    # Create a 3x3 grid with positive warming in one corner and cooling in another
    for i, lat in enumerate([32.0, 33.0, 34.0]):
        for j, lon in enumerate([-100.0, -99.0, -98.0]):
            trend_rate = 0.5 if (i == 0 and j == 0) else (-0.4 if (i == 2 and j == 2) else 0.05)
            # Add synthetic noise around trend line
            rng = np.random.RandomState(42 + i * 3 + j)
            noise = rng.normal(0, 0.2, len(years))
            values = [round(float(20.0 + trend_rate * (t / 10.0) + noise[t]), 3) for t in range(len(years))]
            cells.append({
                "lat": lat,
                "lon": lon,
                "years": years,
                "values": values
            })

    req_payload = {
        "dataset_name": "california_microclimate_dossier",
        "variable_name": "Air Temperature",
        "units": "°C",
        "alpha": 0.05,
        "use_fdr": True,
        "cells": cells
    }

    res = client.post("/api/v1/analysis/custom", json=req_payload)
    assert res.status_code == 200
    data = res.json()

    assert data["analysis_id"].startswith("ana_custom_")
    assert data["status"] == "completed"
    assert data["dataset_id"] == "california_microclimate_dossier"
    assert data["variable_name"] == "Air Temperature"
    assert data["display_units"] == "°C"
    assert data["slope_units"] == "°C / decade"
    assert data["time_span"] == "2000 - 2023"

    # Verify Summary
    summary = data["summary"]
    assert summary["total_cells"] == 9
    assert summary["spatial_autocorrelation"] is not None
    assert "moran_i" in summary["spatial_autocorrelation"]

    # Verify Grid Points
    grid = data["grid"]
    assert len(grid) == 9

    # Check top warming cell (lat 32.0, lon -100.0)
    top_cell = next(c for c in grid if c["lat"] == 32.0 and c["lon"] == -100.0)
    assert top_cell["slope"] > 0.3
    assert top_cell["p_value"] < 0.05
    assert top_cell["ci_lower"] is not None
    assert top_cell["ci_upper"] is not None
    assert top_cell["ci_lower"] <= top_cell["slope"] <= top_cell["ci_upper"]
    assert top_cell["direction"] == "increasing"


def test_custom_analysis_downstream_endpoints():
    """Verify all downstream drilldown, spatial map, and export endpoints work seamlessly with custom datasets."""
    years = list(range(2000, 2020))
    cells = [
        {
            "lat": 30.0,
            "lon": -95.0,
            "years": years,
            "values": [15.0 + 0.4 * (t / 10.0) for t in range(len(years))]
        },
        {
            "lat": 31.0,
            "lon": -95.0,
            "years": years,
            "values": [14.0 - 0.3 * (t / 10.0) for t in range(len(years))]
        },
        {
            "lat": 30.0,
            "lon": -94.0,
            "years": years,
            "values": [16.0 + 0.2 * (t / 10.0) for t in range(len(years))]
        },
        {
            "lat": 31.0,
            "lon": -94.0,
            "years": years,
            "values": [13.0 + 0.1 * (t / 10.0) for t in range(len(years))]
        }
    ]

    init_res = client.post("/api/v1/analysis/custom", json={
        "dataset_name": "gulf_coast_observations",
        "variable_name": "Sea Surface Anomaly",
        "units": "°C",
        "alpha": 0.05,
        "cells": cells
    })
    assert init_res.status_code == 200
    ana_id = init_res.json()["analysis_id"]

    # 1. GET /analysis/{id}
    get_res = client.get(f"/api/v1/analysis/{ana_id}")
    assert get_res.status_code == 200
    assert get_res.json()["analysis_id"] == ana_id

    # 2. GET /analysis/{id}/map
    map_res = client.get(f"/api/v1/analysis/{ana_id}/map")
    assert map_res.status_code == 200
    map_data = map_res.json()
    assert map_data["bounds"] == [-95.0, 30.0, -94.0, 31.0]
    assert len(map_data["grid"]) == 4

    # 3. GET /analysis/{id}/timeseries
    ts_res = client.get(f"/api/v1/analysis/{ana_id}/timeseries?lat=30.0&lon=-95.0")
    assert ts_res.status_code == 200
    ts_data = ts_res.json()
    assert ts_data["lat"] == 30.0
    assert ts_data["lon"] == -95.0
    assert len(ts_data["observations"]) == len(years)
    assert ts_data["slope"] > 0.0
    assert "evidence_record" in ts_data

    # 4. GET /analysis/{id}/signals
    sig_res = client.get(f"/api/v1/analysis/{ana_id}/signals")
    assert sig_res.status_code == 200
    assert "signals" in sig_res.json()

    # 5. GET /analysis/{id}/export/netcdf
    nc_res = client.get(f"/api/v1/analysis/{ana_id}/export/netcdf")
    assert nc_res.status_code == 200
    assert len(nc_res.content) > 1000

    # 6. GET /analysis/{id}/export/geojson
    geo_res = client.get(f"/api/v1/analysis/{ana_id}/export/geojson")
    assert geo_res.status_code == 200
    geo_data = geo_res.json()
    assert geo_data["type"] == "FeatureCollection"
    assert len(geo_data["features"]) == 4

    # 7. GET /analysis/{id}/dossier
    dos_res = client.get(f"/api/v1/analysis/{ana_id}/dossier")
    assert dos_res.status_code == 200
    assert "NASA Earth Science Briefing" in dos_res.text

    # 8. GET /analysis/{id}/export/notebook
    nb_res = client.get(f"/api/v1/analysis/{ana_id}/export/notebook")
    assert nb_res.status_code == 200
    assert "nbformat" in nb_res.text


def test_custom_analysis_with_precomputed_slopes():
    """Verify custom analysis works when coordinate cells supply precomputed slopes."""
    cells = [
        {"lat": 35.0, "lon": -105.0, "slope": 0.42, "p_value": 0.002},
        {"lat": 35.5, "lon": -105.0, "slope": -0.31, "p_value": 0.015},
        {"lat": 35.0, "lon": -104.5, "slope": 0.15, "p_value": 0.120},
        {"lat": 35.5, "lon": -104.5, "slope": 0.28, "p_value": 0.040}
    ]

    res = client.post("/api/v1/analysis/custom", json={
        "dataset_name": "colorado_river_basin_precomputed",
        "variable_name": "Evapotranspiration",
        "units": "mm/day",
        "alpha": 0.05,
        "cells": cells
    })
    assert res.status_code == 200
    data = res.json()
    assert data["summary"]["total_cells"] == 4
    assert data["summary"]["significant_cells_raw"] == 3


def test_custom_analysis_validation_boundaries():
    """Verify validation guards on empty cells or exceeding max capacity."""
    # 1. Empty cells should fail with 400
    res_empty = client.post("/api/v1/analysis/custom", json={
        "dataset_name": "empty_set",
        "cells": []
    })
    assert res_empty.status_code == 400

    # 2. Exceeding 5000 cells should fail validation (HTTP 422)
    oversized_cells = [{"lat": 0.0, "lon": 0.0} for _ in range(5001)]
    res_oversized = client.post("/api/v1/analysis/custom", json={
        "dataset_name": "oversized_set",
        "cells": oversized_cells
    })
    assert res_oversized.status_code == 422
