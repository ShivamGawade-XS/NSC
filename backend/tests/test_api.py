"""
Integration tests for EarthSift FastAPI Endpoints.
Verifies all typed endpoints:
- GET /health and /api/v1/health
- GET /datasets and /datasets/{id}
- GET /variables
- POST /analysis
- GET /analysis/{id}
- GET /analysis/{id}/map
- GET /analysis/{id}/timeseries
- GET /analysis/{id}/signals
- GET /analysis/{id}/contrasts
- GET /analysis/{id}/provenance
- POST /explain
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check_endpoints():
    """Verify health endpoint responds at both /health and /api/v1/health."""
    for path in ["/health", "/api/v1/health"]:
        res = client.get(path)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert "EarthSift" in data["service"]
        assert "engine" in data


def test_list_datasets_and_single_dataset():
    """Verify dataset listing and single dataset drilldown."""
    res = client.get("/datasets")
    assert res.status_code == 200
    datasets = res.json()
    assert len(datasets) > 0
    
    merra2 = next((d for d in datasets if d["dataset_id"] == "merra2_reanalysis"), None)
    assert merra2 is not None
    assert "T2M" in merra2["variables"]
    assert "PRECTOT" in merra2["variables"]

    # Test GET /datasets/{id}
    res_single = client.get("/datasets/merra2_reanalysis")
    assert res_single.status_code == 200
    assert res_single.json()["dataset_id"] == "merra2_reanalysis"

    # Test 404 for invalid dataset
    res_invalid = client.get("/datasets/nonexistent_dataset")
    assert res_invalid.status_code == 404


def test_list_variables():
    """Verify /variables endpoint returns catalog of variables."""
    res = client.get("/variables")
    assert res.status_code == 200
    vars_list = res.json()
    assert len(vars_list) >= 2
    var_ids = [v["variable_id"] for v in vars_list]
    assert "T2M" in var_ids
    assert "PRECTOT" in var_ids


def test_analysis_validation_errors():
    """Verify invalid payloads fail with 400 or 422."""
    # Start year > end year
    res = client.post("/analysis", json={
        "dataset_id": "merra2_reanalysis",
        "variable_id": "T2M",
        "start_year": 2020,
        "end_year": 2000
    })
    assert res.status_code == 400

    # Nonexistent variable
    res = client.post("/analysis", json={
        "dataset_id": "merra2_reanalysis",
        "variable_id": "UNKNOWN_VAR",
        "start_year": 2000,
        "end_year": 2020
    })
    assert res.status_code == 400


def test_full_analysis_workflow_and_sub_endpoints():
    """
    Test complete lifecycle:
    POST /analysis -> GET /analysis/{id} -> /map -> /timeseries -> /signals -> /contrasts -> /provenance
    """
    payload = {
        "dataset_id": "merra2_reanalysis",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2023,
        "alpha": 0.05
    }

    # 1. POST /analysis
    res = client.post("/analysis", json=payload)
    assert res.status_code == 200
    ana = res.json()
    analysis_id = ana["analysis_id"]
    assert ana["status"] == "completed"
    assert len(ana["grid"]) > 0
    assert ana["summary"]["total_cells"] == len(ana["grid"])

    # 2. GET /analysis/{id}
    res_get = client.get(f"/analysis/{analysis_id}")
    assert res_get.status_code == 200
    assert res_get.json()["analysis_id"] == analysis_id

    # 3. GET /analysis/{id}/map
    res_map = client.get(f"/analysis/{analysis_id}/map")
    assert res_map.status_code == 200
    map_data = res_map.json()
    assert "bounds" in map_data
    assert len(map_data["grid"]) > 0
    assert map_data["variable_id"] == "T2M"

    # 4. GET /analysis/{id}/timeseries (with explicit lat/lon)
    sample_pt = ana["grid"][0]
    res_ts = client.get(
        f"/analysis/{analysis_id}/timeseries",
        params={"lat": sample_pt["lat"], "lon": sample_pt["lon"]}
    )
    assert res_ts.status_code == 200
    ts_data = res_ts.json()
    assert len(ts_data["years"]) == 24
    assert len(ts_data["observations"]) == 24
    assert len(ts_data["fitted_values"]) == 24
    assert "evidence_record" in ts_data
    assert "observation" in ts_data["evidence_record"]
    assert "significance" in ts_data["evidence_record"]
    assert "is_synthetic" in ts_data["evidence_record"]

    # Also test /cell endpoint alias
    res_cell = client.get(
        f"/analysis/{analysis_id}/cell",
        params={"lat": sample_pt["lat"], "lon": sample_pt["lon"]}
    )
    assert res_cell.status_code == 200
    assert res_cell.json()["lat"] == ts_data["lat"]

    # Test /timeseries without lat/lon (defaults to top candidate signal)
    res_ts_default = client.get(f"/analysis/{analysis_id}/timeseries")
    assert res_ts_default.status_code == 200
    assert len(res_ts_default.json()["years"]) == 24

    # 5. GET /analysis/{id}/signals (Discovery Engine)
    res_signals = client.get(f"/analysis/{analysis_id}/signals")
    assert res_signals.status_code == 200
    signals_data = res_signals.json()
    assert "signals" in signals_data
    assert len(signals_data["signals"]) > 0
    top_sig = signals_data["signals"][0]
    assert "discovery_score" in top_sig
    assert "ranking_rationale" in top_sig
    assert top_sig["discovery_score"] >= signals_data["signals"][-1]["discovery_score"]

    # 6. GET /analysis/{id}/contrasts (Contrast Engine)
    res_contrasts = client.get(f"/analysis/{analysis_id}/contrasts")
    assert res_contrasts.status_code == 200
    contrasts_data = res_contrasts.json()
    assert "contrasts" in contrasts_data
    assert contrasts_data["contrasts_found"] >= 0

    # 7. GET /analysis/{id}/provenance
    res_prov = client.get(f"/analysis/{analysis_id}/provenance")
    assert res_prov.status_code == 200
    prov_data = res_prov.json()
    assert prov_data["dataset_id"] == "merra2_reanalysis"
    assert "source" in prov_data["provenance"]
    assert "is_synthetic" in prov_data["provenance"]


def test_explain_endpoint():
    """Verify downstream explainer synthesizes verified evidence without hallucinations."""
    payload = {
        "variable_name": "2-Meter Air Temperature",
        "location": "North America [35.0°N, -95.0°W]",
        "time_span": "2000 - 2023",
        "slope": 0.342,
        "slope_units": "°C / decade",
        "p_value": 0.0024,
        "q_value": 0.0041,
        "significant": True,
        "direction": "increasing",
        "sample_count": 24,
        "source": "NASA MERRA-2"
    }

    response = client.post("/explain", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert "summary" in data
    assert "+0.342 °C / decade" in data["summary"]
    assert "statistically significant" in data["statistical_assessment"]
    assert "limitations" in data


def test_404_for_unknown_analysis():
    """Verify appropriate 404 response for non-existent analysis IDs."""
    for sub in ["", "/map", "/timeseries", "/signals", "/contrasts", "/provenance"]:
        res = client.get(f"/analysis/ana_nonexistent_12345{sub}")
        assert res.status_code == 404
