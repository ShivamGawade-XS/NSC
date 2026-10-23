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

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_check_endpoints():
    """Verify health, ready, auth/status, and metrics endpoints respond at both root and /api/v1 paths."""
    # 1. GET /health and /api/v1/health
    for path in ["/health", "/api/v1/health"]:
        res = client.get(path)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert "EarthSift" in data["service"]
        assert "engine" in data

    # 2. GET /ready and /api/v1/ready
    for path in ["/ready", "/api/v1/ready"]:
        res = client.get(path)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ready"
        assert data["ready"] is True
        assert "engine" in data


    # 3. GET /auth/status and /api/v1/auth/status
    for path in ["/auth/status", "/api/v1/auth/status"]:
        res = client.get(path)
        assert res.status_code == 200
        data = res.json()
        assert "authenticated" in data
        assert "auth_type" in data


    # 4. GET /metrics and /api/v1/metrics
    for path in ["/metrics", "/api/v1/metrics"]:
        res = client.get(path)
        assert res.status_code == 200
        data = res.json()
        assert "uptime_seconds" in data
        assert "database_cache" in data
        assert "memory_rss_mb" in data
        assert data["status"] == "operational"



def test_list_datasets_and_single_dataset():
    """Verify dataset listing and single dataset drilldown on both /datasets and /api/v1/datasets."""
    for base in ["", "/api/v1"]:
        res = client.get(f"{base}/datasets")
        assert res.status_code == 200
        datasets = res.json()
        assert len(datasets) > 0
        
        merra2 = next((d for d in datasets if d["dataset_id"] == "merra2_reanalysis"), None)
        assert merra2 is not None
        assert "T2M" in merra2["variables"]
        assert "PRECTOT" in merra2["variables"]

        # Test GET /datasets/{id}
        res_single = client.get(f"{base}/datasets/merra2_reanalysis")
        assert res_single.status_code == 200
        assert res_single.json()["dataset_id"] == "merra2_reanalysis"

        # Test 404 for invalid dataset
        res_invalid = client.get(f"{base}/datasets/nonexistent_dataset")
        assert res_invalid.status_code == 404


def test_list_variables():
    """Verify /variables and /api/v1/variables endpoints return catalog of variables."""
    for base in ["", "/api/v1"]:
        res = client.get(f"{base}/variables")
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
    assert res.status_code in (400, 422)

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
    assert "tau" in top_sig
    assert top_sig["tau"] is not None
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

    # 8. GET /analysis/{id}/velocity
    res_vel = client.get(f"/analysis/{analysis_id}/velocity")
    assert res_vel.status_code == 200
    vel_data = res_vel.json()
    assert "vectors" in vel_data
    assert "summary" in vel_data

    # 9. Verify versioned /api/v1/analysis and all versioned sub-endpoints
    res_v1 = client.post("/api/v1/analysis", json=payload)
    assert res_v1.status_code == 200
    ana_id_v1 = res_v1.json()["analysis_id"]

    for sub in ["", "/map", "/timeseries", "/cell", "/signals", "/contrasts", "/provenance", "/velocity"]:
        res_sub = client.get(f"/api/v1/analysis/{ana_id_v1}{sub}")
        assert res_sub.status_code == 200



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
    assert "0.342" in data["summary"]
    assert "signific" in data["statistical_assessment"].lower()
    assert "limitations" in data
    assert "physical_hypotheses" in data
    assert data["physical_hypotheses"] is not None and len(data["physical_hypotheses"]) > 0
    assert "bibtex_citations" in data
    assert data["bibtex_citations"] is not None and len(data["bibtex_citations"]) > 0

    # Also test versioned /api/v1/explain endpoint
    resp_v1 = client.post("/api/v1/explain", json=payload)
    assert resp_v1.status_code == 200


def test_404_for_unknown_analysis():
    """Verify appropriate 404 response for non-existent analysis IDs."""
    for sub in ["", "/map", "/timeseries", "/signals", "/contrasts", "/provenance"]:
        res = client.get(f"/analysis/ana_nonexistent_12345{sub}")
        assert res.status_code == 404


def test_compound_hazard_analysis_endpoint():
    """Verify the dual-variable compound climate hazard endpoint calculates CAI and classifications."""
    payload = {
        "dataset_id": "merra2_reanalysis",
        "temp_variable_id": "T2M",
        "precip_variable_id": "PRECTOT",
        "start_year": 2000,
        "end_year": 2023
    }
    res = client.post("/analysis/compound", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "aridification_fraction" in data
    assert "intensification_fraction" in data
    assert "hazard_distribution" in data
    assert "cells" in data
    assert len(data["cells"]) > 0
    # Verify CAI and classification structure
    cell0 = data["cells"][0]
    assert "cai" in cell0
    assert "hazard_class" in cell0
    assert "temp_slope" in cell0
    assert "precip_slope" in cell0
    assert "years" in cell0 and len(cell0["years"]) > 0
    assert "temp_observations" in cell0 and len(cell0["temp_observations"]) == len(cell0["years"])
    assert "temp_fitted_values" in cell0 and len(cell0["temp_fitted_values"]) == len(cell0["years"])
    assert "precip_observations" in cell0 and len(cell0["precip_observations"]) == len(cell0["years"])
    assert "precip_fitted_values" in cell0 and len(cell0["precip_fitted_values"]) == len(cell0["years"])

    # Also verify /api/v1/analysis/compound
    res_v1 = client.post("/api/v1/analysis/compound", json=payload)
    assert res_v1.status_code == 200


def test_merra2_analysis_ingests_real_netcdf():
    """Verify MERRA2 trend analysis does not fall back to synthetic data when fixtures exist."""
    payload = {
        "dataset_id": "merra2_reanalysis",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2023
    }
    res = client.post("/analysis", json=payload)
    assert res.status_code == 200
    data = res.json()
    # Check provenance
    assert data["provenance"]["is_synthetic"] is False
    assert "NetCDF" in data["provenance"]["data_source_label"]


def test_spa_catchall_and_unmapped_api_routes():
    """Verify unmapped API routes return JSON 404 rather than SPA HTML, and path traversal is blocked."""
    # 1. Unmapped /api/v1 endpoint must return JSON 404, not HTML
    res_api_v1 = client.get("/api/v1/nonexistent_scientific_route")
    assert res_api_v1.status_code == 404
    assert res_api_v1.headers.get("content-type", "").startswith("application/json")
    assert res_api_v1.json()["detail"] == "API endpoint not found"

    # 2. Unmapped /api endpoint must return JSON 404
    res_api = client.get("/api")
    assert res_api.status_code == 404
    assert res_api.headers.get("content-type", "").startswith("application/json")

    res_api_sub = client.get("/api/unknown")
    assert res_api_sub.status_code == 404
    assert res_api_sub.headers.get("content-type", "").startswith("application/json")

    # 3. Path traversal attempts must not expose backend code
    res_traversal = client.get("/../../backend/app/main.py")
    assert "from app.core.config" not in res_traversal.text

    # 4. Valid client-side route returns React SPA index.html (when dist exists)
    from pathlib import Path
    react_dist = Path(__file__).resolve().parent.parent.parent / "frontend-react" / "dist"
    if (react_dist / "index.html").exists():
        res_spa = client.get("/dashboard")
        assert res_spa.status_code == 200
        assert "<!doctype html>" in res_spa.text.lower()


def test_custom_analysis_endpoint_statistics():
    """Verify POST /api/v1/analysis/custom computes real Mann-Kendall, Sen's slope, FDR, and Moran's I on custom uploaded cell arrays."""
    import numpy as np
    years = list(range(2000, 2024))
    cells = []

    for i, lat in enumerate([32.0, 33.0, 34.0]):
        for j, lon in enumerate([-100.0, -99.0, -98.0]):
            trend_rate = 0.5 if (i == 0 and j == 0) else (-0.4 if (i == 2 and j == 2) else 0.05)
            rng = np.random.RandomState(100 + i * 3 + j)
            noise = rng.normal(0, 0.15, len(years))
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

    for path in ["/analysis/custom", "/api/v1/analysis/custom"]:
        res = client.post(path, json=req_payload)
        assert res.status_code == 200
        data = res.json()
        assert data["analysis_id"].startswith("ana_custom_")
        assert data["status"] == "completed"
        # Verify Moran's I
        assert data["summary"]["spatial_autocorrelation"] is not None
        assert "moran_i" in data["summary"]["spatial_autocorrelation"]
        # Verify cell-level Mann-Kendall, Sen's slope, FDR
        grid = data["grid"]
        assert len(grid) == 9
        top_warming = next(c for c in grid if c["lat"] == 32.0 and c["lon"] == -100.0)
        assert top_warming["slope"] > 0.3
        assert top_warming["p_value"] < 0.05
        assert top_warming["q_value"] is not None
        assert top_warming["ci_lower"] <= top_warming["slope"] <= top_warming["ci_upper"]


def test_compare_locations_pin_a_pin_b():
    """Verify POST /api/v1/analysis/compare computes Pin A vs Pin B comparative analytics."""
    ana_res = client.post("/api/v1/analysis", json={
        "dataset_id": "merra2_reanalysis",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2020
    })
    assert ana_res.status_code == 200
    analysis_id = ana_res.json()["analysis_id"]

    for path in ["/analysis/compare", "/api/v1/analysis/compare"]:
        comp_res = client.post(path, json={
            "analysis_id": analysis_id,
            "lat_a": 35.0,
            "lon_a": -95.0,
            "lat_b": 38.0,
            "lon_b": -90.0
        })
        assert comp_res.status_code == 200
        comp_data = comp_res.json()
        assert "delta_slope" in comp_data
        assert "cross_correlation_r" in comp_data
        assert "loc_a" in comp_data
        assert "loc_b" in comp_data


def test_attribution_endpoint():
    """Verify POST /api/v1/analysis/attribution calculates Fraction of Attributable Risk (FAR)."""
    payload = {
        "slope": 0.35,
        "n_years": 24,
        "series": [10.0 + 0.35 * (t / 10.0) for t in range(24)],
        "alpha": 0.05
    }
    for path in ["/analysis/attribution", "/api/v1/analysis/attribution"]:
        resp = client.post(path, json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert "fraction_of_attributable_risk" in data
        assert "risk_ratio" in data
        assert "p1_factual_probability" in data
        assert "p0_counterfactual_probability" in data
        assert "far_ci_lower" in data
        assert "far_ci_upper" in data


def test_copilot_parse_query_endpoint():
    """Verify POST /api/v1/copilot/parse-query translates natural language to typed analysis request."""
    payload = {"query": "Show warming trends in Texas from 2000 to 2023"}
    for path in ["/copilot/parse-query", "/api/v1/copilot/parse-query"]:
        res = client.post(path, json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "raw_query" in data
        assert "interpreted_intent" in data
        assert "analysis_request" in data
        assert data["analysis_request"]["variable_id"] == "T2M"
        assert data["analysis_request"]["start_year"] == 2000
        assert data["analysis_request"]["end_year"] == 2023



