"""
Integration tests for EarthSift FastAPI Endpoints.
Verifies dataset listing, analysis execution, cell drilldown, and explanation services.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check():
    """Verify health endpoint responds with healthy status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "EarthSift" in data["service"]


def test_list_datasets():
    """Verify dataset catalog contains MERRA-2 with valid variables."""
    response = client.get("/api/v1/datasets")
    assert response.status_code == 200
    datasets = response.json()
    assert len(datasets) > 0
    merra2 = next((d for d in datasets if d["dataset_id"] == "merra2_reanalysis"), None)
    assert merra2 is not None
    assert "T2M" in merra2["variables"]
    assert "PRECTOT" in merra2["variables"]


def test_run_analysis_and_cell_drilldown():
    """Verify full end-to-end slice: trigger analysis, retrieve grid, inspect cell evidence."""
    payload = {
        "dataset_id": "merra2_reanalysis",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2023,
        "alpha": 0.05
    }
    
    # 1. Trigger analysis
    response = client.post("/api/v1/analysis", json=payload)
    assert response.status_code == 200
    res_data = response.json()
    
    assert res_data["status"] == "completed"
    assert res_data["summary"]["total_cells"] > 0
    assert len(res_data["grid"]) > 0
    assert "contrasts" in res_data
    
    analysis_id = res_data["analysis_id"]
    
    # 2. Inspect a cell
    sample_cell = res_data["grid"][0]
    cell_resp = client.get(
        f"/api/v1/analysis/{analysis_id}/cell",
        params={"lat": sample_cell["lat"], "lon": sample_cell["lon"]}
    )
    assert cell_resp.status_code == 200
    cell_data = cell_resp.json()
    
    assert len(cell_data["years"]) == 24
    assert len(cell_data["observations"]) == 24
    assert len(cell_data["fitted_values"]) == 24
    assert "evidence_record" in cell_data
    assert "observation" in cell_data["evidence_record"]
    assert "significance" in cell_data["evidence_record"]


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
    
    response = client.post("/api/v1/explain", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    assert "summary" in data
    assert "+0.342 °C / decade" in data["summary"]
    assert "statistically significant" in data["statistical_assessment"]
    assert "limitations" in data
