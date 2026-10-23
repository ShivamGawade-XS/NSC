"""
Application and Resilience Tests for EarthSift.
Verifies:
- invalid request handling (validation errors)
- empty result handling
- data failure / boundary condition
- cache reuse (idempotent retrieval)
- offline / demo mode
- AI unavailable (deterministic fallback)
- malformed AI request handling
"""

from fastapi.testclient import TestClient

from app.api.endpoints import ANALYSIS_CACHE
from app.main import app

client = TestClient(app)


def test_invalid_analysis_request_body():
    """Verify malformed JSON or invalid types return 422 unprocessable entity."""
    res = client.post("/analysis", json={"dataset_id": 12345})
    assert res.status_code == 422


def test_cache_reuse_and_idempotency():
    """Verify running the exact same analysis reuses or overwrites cached record cleanly."""
    payload = {
        "dataset_id": "merra2_reanalysis",
        "variable_id": "T2M",
        "start_year": 2005,
        "end_year": 2020,
        "alpha": 0.05
    }

    # First run
    res1 = client.post("/analysis", json=payload)
    assert res1.status_code == 200
    id1 = res1.json()["analysis_id"]
    assert id1 in ANALYSIS_CACHE

    # Second run with same parameters returns same analysis_id
    res2 = client.post("/analysis", json=payload)
    assert res2.status_code == 200
    id2 = res2.json()["analysis_id"]
    assert id1 == id2


def test_empty_result_out_of_bounds_bbox():
    """Verify requesting an out-of-bounds bbox raises 400 error cleanly."""
    payload = {
        "dataset_id": "merra2_reanalysis",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2020,
        "bbox": [-10.0, 10.0, -5.0, 15.0]  # Outside North America sample grid
    }
    res = client.post("/analysis", json=payload)
    assert res.status_code == 400
    assert "empty slice" in res.json()["detail"].lower()


def test_offline_demo_mode_data_provenance():
    """Verify demo mode sets explicit synthetic labels in the API response."""
    payload = {
        "dataset_id": "merra2_reanalysis",
        "variable_id": "PRECTOT",
        "start_year": 2000,
        "end_year": 2015,
        "prefer_live": False
    }
    res = client.post("/analysis", json=payload)
    assert res.status_code == 200
    prov = res.json()["provenance"]
    assert prov["is_synthetic"] is True
    assert prov["data_source_label"] == "Synthetic test data — not NASA observations."


def test_real_netcdf_mode_data_provenance():
    """Verify NASA POWER adapter and MERRA-2 prefer_live=True return verified observational labels and handle clamping."""
    # 1. NASA POWER authentic NetCDF ingestion
    payload_power = {
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2020,
        "bbox": [-101.0, 31.0, -95.0, 37.0],
        "prefer_live": False
    }
    res = client.post("/analysis", json=payload_power)
    assert res.status_code == 200
    prov = res.json()["provenance"]
    assert prov["is_synthetic"] is False
    assert "NASA" in prov["data_source_label"]

    # 2. MERRA-2 prefer_live=True authentic NetCDF ingestion
    payload_merra2_real = {
        "dataset_id": "merra2_reanalysis",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2020,
        "bbox": [-100.0, 30.0, -90.0, 40.0],
        "prefer_live": True
    }
    res_m2 = client.post("/analysis", json=payload_merra2_real)
    assert res_m2.status_code == 200
    prov_m2 = res_m2.json()["provenance"]
    assert prov_m2["is_synthetic"] is False
    assert "NASA GMAO MERRA-2" in prov_m2["data_source_label"]

    # 3. NASA POWER bbox exceeding 10° x 10° sets bbox_clamped and warning
    payload_clamped = {
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2010,
        "bbox": [-115.0, 25.0, -95.0, 45.0],  # 20° x 20°
        "prefer_live": False
    }
    res_clamp = client.post("/analysis", json=payload_clamped)
    assert res_clamp.status_code == 200
    prov_clamp = res_clamp.json()["provenance"]
    assert prov_clamp.get("bbox_clamped") is True
    assert "warning" in prov_clamp and prov_clamp["warning"] is not None
    assert "exceeded NASA POWER 10°" in prov_clamp["warning"]



def test_nasa_power_spatial_trend_quality():
    """Verify NASA POWER real data produces ci_lower < ci_upper and valid moran stats in response."""
    payload = {
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 1990,
        "end_year": 2023,
        "bbox": [-101.0, 31.0, -95.0, 37.0],
        "prefer_live": False
    }
    res = client.post("/analysis", json=payload)
    assert res.status_code == 200
    data = res.json()
    # Check that confidence intervals exist on grid cells
    grid = data["grid"]
    assert len(grid) > 0
    sample = grid[0]
    assert "ci_lower" in sample
    assert "ci_upper" in sample
    assert sample["ci_lower"] <= sample["ci_upper"]  # Valid CI ordering
    # Check spatial autocorrelation summary
    summary = data["summary"]
    assert "spatial_autocorrelation" in summary
    assert "moran_i" in summary["spatial_autocorrelation"]
    assert "p_value" in summary["spatial_autocorrelation"]
    # Verify authentic data label
    assert data["provenance"]["is_synthetic"] is False


def test_ai_explainer_fallback_and_validation():
    """Verify explain endpoint behaves deterministically when external AI is offline."""
    valid_payload = {
        "variable_name": "Total Precipitation Rate",
        "location": "Southwest US [32.0°N, -105.0°W]",
        "time_span": "2000 - 2020",
        "slope": -0.155,
        "slope_units": "mm / day / decade",
        "p_value": 0.0031,
        "q_value": 0.0062,
        "significant": True,
        "direction": "decreasing",
        "sample_count": 21,
        "source": "NASA MERRA-2"
    }
    res = client.post("/explain", json=valid_payload)
    assert res.status_code == 200
    data = res.json()
    assert "summary" in data
    assert "statistical_assessment" in data
    assert "limitations" in data
    assert "-0.155" in data["summary"]
    assert any(term in data["summary"].lower() for term in ["decreas", "decline", "reduction"])


def test_malformed_ai_request():
    """Verify malformed explain requests are rejected with 422."""
    malformed_payload = {
        "variable_name": "T2M"
        # Missing required statistical fields
    }
    res = client.post("/explain", json=malformed_payload)
    assert res.status_code == 422


def test_cache_collision_prevention_on_bbox_and_alpha():
    """Verify different bounding boxes and significance thresholds yield distinct cache keys."""
    base_payload = {
        "dataset_id": "merra2_reanalysis",
        "variable_id": "T2M",
        "start_year": 2005,
        "end_year": 2018,
        "alpha": 0.05,
        "bbox": [-120.0, 30.0, -90.0, 45.0]
    }
    res1 = client.post("/analysis", json=base_payload)
    assert res1.status_code == 200
    id1 = res1.json()["analysis_id"]

    # Different bbox
    payload_bbox2 = dict(base_payload, bbox=[-110.0, 32.0, -85.0, 48.0])
    res2 = client.post("/analysis", json=payload_bbox2)
    assert res2.status_code == 200
    id2 = res2.json()["analysis_id"]
    assert id1 != id2, "Analyses with different bounding boxes must NOT collide in cache"

    # Different alpha
    payload_alpha = dict(base_payload, alpha=0.01)
    res3 = client.post("/analysis", json=payload_alpha)
    assert res3.status_code == 200
    id3 = res3.json()["analysis_id"]
    assert id1 != id3, "Analyses with different alpha values must NOT collide in cache"


def test_contrast_clustering_structure():
    """Verify contrasting engine produces structured clusters respecting schema."""
    res = client.post("/analysis", json={
        "dataset_id": "merra2_reanalysis",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2023,
        "alpha": 0.05
    })
    assert res.status_code == 200
    contrasts = res.json()["contrasts"]
    assert isinstance(contrasts, list)
    if len(contrasts) > 0:
        c = contrasts[0]
        assert "contrast_id" in c
        assert "magnitude_delta" in c
        assert "region_increasing" in c
        assert "region_decreasing" in c
        assert c["region_increasing"]["cell_count"] >= 1
        assert c["region_decreasing"]["cell_count"] >= 1

