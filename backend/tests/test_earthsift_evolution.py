"""
EarthSift 2.0 — Scientific Intelligence & Core Evolution Test Suite
Tests for:
1. Pre-flight Scientific Quality Gate (/analysis/quality-gate)
2. Trend Robustness Lab (/analysis/{id}/robustness)
3. Side-by-Side Regional Trend Detective (/analysis/compare-regions)
4. Earth System Trend Discovery (/analysis/discover-trends)
5. Data Quality & Source Continuity Inspector (/analysis/{id}/quality-profile)
6. Reproducible Analysis Dossier (/analysis/{id}/reproducibility)
7. Enriched Variable Catalog (/variables)
"""

from fastapi.testclient import TestClient

from app.main import app
from app.science.robustness import evaluate_trend_robustness

client = TestClient(app)


def test_enriched_variable_catalog_domains_and_references():
    """Verify that /variables exposes physical domains, temporal bounds, and references."""
    resp = client.get("/api/v1/variables")
    assert resp.status_code == 200
    vars_list = resp.json()
    assert len(vars_list) >= 7

    # Check T2M metadata
    t2m_vars = [v for v in vars_list if v["variable_id"] == "T2M"]
    assert len(t2m_vars) >= 1
    t2m = t2m_vars[0]
    assert t2m["physical_domain"] == "Thermal & Temperature"
    assert t2m["earliest_year"] in (1980, 1981)
    assert t2m["latest_year"] >= 2023
    assert t2m["temporal_aggregation"] == "annual_mean"
    assert len(t2m["suitable_analysis_types"]) >= 3
    assert len(t2m["scientific_references"]) >= 1


def test_quality_gate_optimal_window():
    """Verify that quality gate accepts a 24-year continuous window as SUPPORTED."""
    payload = {
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2023,
        "bbox": [-102.0, 30.0, -94.0, 38.0],
    }
    resp = client.post("/api/v1/analysis/quality-gate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "SUPPORTED"
    assert data["can_execute"] is True
    assert data["meets_climatological_threshold"] is True
    assert data["observation_count"] == 24
    assert data["grid_intersection_cells"] > 0
    assert len(data["limitations"]) == 0


def test_quality_gate_insufficient_samples():
    """Verify quality gate blocks time spans < 3 years as INSUFFICIENT_DATA."""
    payload = {
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2020,
        "end_year": 2021,
    }
    resp = client.post("/api/v1/analysis/quality-gate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "INSUFFICIENT_DATA"
    assert data["can_execute"] is False
    assert any("fewer than 3" in lim.lower() for lim in data["limitations"])


def test_quality_gate_solar_transition_blocked():
    """Verify quality gate intercepts solar radiation crossing 2000/2001."""
    payload = {
        "dataset_id": "nasa_power",
        "variable_id": "ALLSKY_SFC_SW_DWN",
        "start_year": 1995,
        "end_year": 2010,
    }
    resp = client.post("/api/v1/analysis/quality-gate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "UNSUPPORTED_FOR_THIS_METHOD"
    assert data["can_execute"] is False
    assert "discontinuous" in data["sensor_continuity"]
    assert any("gewex srb" in lim.lower() for lim in data["limitations"])
    assert data["recommended_window"] == [2001, 2010]


def test_quality_gate_subgrid_zero_cells():
    """Verify quality gate detects zero-cell intersection between grid lines."""
    payload = {
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2023,
        "bbox": [-94.9, 30.1, -94.7, 30.3],
    }
    resp = client.post("/api/v1/analysis/quality-gate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "UNSUPPORTED_FOR_THIS_METHOD"
    assert data["can_execute"] is False
    assert data["grid_intersection_cells"] == 0
    assert any("does not intersect any grid cell" in lim.lower() for lim in data["limitations"])


def test_evaluate_trend_robustness_synthetic_ground_truth():
    """Direct mathematical unit test on evaluate_trend_robustness."""
    import numpy as np

    # Clean linear warming trend with slight noise
    years = np.arange(2000, 2024)
    obs = 15.0 + 0.35 * (years - 2000) + np.random.normal(0, 0.05, len(years))

    res = evaluate_trend_robustness(years, obs, alpha=0.05)
    assert res["stability_rating"] == "ROBUST"
    assert res["sign_agreement_pct"] == 100.0
    assert res["significance_retention_pct"] >= 80.0
    assert 0.30 <= res["base_slope"] <= 0.40
    assert len(res["window_sensitivity"]) >= 5
    assert len(res["estimator_comparison"]) == 3
    assert res["autocorrelation_sensitivity"]["iid_p_value"] < 0.01


def test_robustness_lab_endpoint_integration():
    """Test POST /api/v1/analysis/{analysis_id}/robustness end-to-end."""
    # First create an analysis
    analysis_resp = client.post("/api/v1/analysis", json={
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2020,
        "bbox": [-100.0, 32.0, -96.0, 36.0]
    })
    assert analysis_resp.status_code == 200
    analysis_id = analysis_resp.json()["analysis_id"]

    # Now run robustness lab
    rob_resp = client.post(f"/api/v1/analysis/{analysis_id}/robustness", json={})
    assert rob_resp.status_code == 200
    rob_data = rob_resp.json()
    assert rob_data["analysis_id"] == analysis_id
    assert rob_data["stability_rating"] in ("ROBUST", "MODERATELY_SENSITIVE", "HIGHLY_SENSITIVE")
    assert len(rob_data["window_sensitivity"]) >= 1
    assert len(rob_data["estimator_comparison"]) == 3
    assert "narrative" in rob_data["summary_narrative"].lower() or len(rob_data["summary_narrative"]) > 20


def test_compare_distinct_regions_divergence_test():
    """Test Feature C: Side-by-side regional trend detective with slope difference test."""
    payload = {
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2020,
        "region_a_bbox": [-102.0, 30.0, -98.0, 34.0],
        "region_a_name": "Texas Southern Plains",
        "region_b_bbox": [-95.0, 38.0, -91.0, 42.0],
        "region_b_name": "Upper Midwest Belt",
        "alpha": 0.05
    }
    resp = client.post("/api/v1/analysis/compare-regions", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["variable_id"] == "T2M"
    assert "Texas Southern Plains" in data["region_a"]["name"]
    assert "Upper Midwest Belt" in data["region_b"]["name"]
    assert "slope_difference" in data
    assert "z_statistic" in data
    assert "p_value" in data
    assert isinstance(data["is_divergence_significant"], bool)
    assert len(data["divergence_interpretation"]) > 10


def test_data_quality_profile_endpoint():
    """Test Feature D: Data Quality and Source Continuity Inspector."""
    analysis_resp = client.post("/api/v1/analysis", json={
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2020,
        "bbox": [-100.0, 32.0, -96.0, 36.0]
    })
    analysis_id = analysis_resp.json()["analysis_id"]

    resp = client.get(f"/api/v1/analysis/{analysis_id}/quality-profile")
    assert resp.status_code == 200
    data = resp.json()
    assert data["analysis_id"] == analysis_id
    assert data["temporal_completeness_pct"] == 100.0
    assert data["valid_records"] == 21
    assert data["missing_intervals"] == []
    assert "metric_scale_km" in data
    assert data["metric_scale_km"]["delta_lat_km"] > 0
    assert data["metric_scale_km"]["delta_lon_km"] > 0


def test_reproducibility_manifest_endpoint():
    """Test Feature E: Reproducible Analysis Dossier with SHA-256 fingerprint."""
    analysis_resp = client.post("/api/v1/analysis", json={
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2020,
        "bbox": [-100.0, 32.0, -96.0, 36.0]
    })
    analysis_id = analysis_resp.json()["analysis_id"]

    resp = client.get(f"/api/v1/analysis/{analysis_id}/reproducibility")
    assert resp.status_code == 200
    data = resp.json()
    assert data["analysis_id"] == analysis_id
    assert len(data["sha256_fingerprint"]) == 64  # Valid SHA-256 hex string
    assert "python_replication_code" in data
    assert "def theil_sen_slope" in data["python_replication_code"]
    assert len(data["bibtex_citations"]) >= 4


def test_autonomous_trend_discovery_endpoint():
    """Test Feature B: Autonomous Trend Discovery scan across region."""
    payload = {
        "dataset_id": "nasa_power",
        "bbox": [-100.0, 32.0, -96.0, 36.0],
        "start_year": 2005,
        "end_year": 2020,
        "variable_ids": ["T2M", "WS10M"],
        "alpha": 0.05
    }
    resp = client.post("/api/v1/analysis/discover-trends", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "scan_id" in data
    assert data["total_tests_conducted"] > 0
    assert "ranked_candidates" in data
    if data["ranked_candidates"]:
        top = data["ranked_candidates"][0]
        assert top["variable_id"] in ("T2M", "WS10M")
        assert top["discovery_score"] > 0
        assert top["discovery_badge"] in ("STRONG_DISCOVERY", "EMERGING_SIGNAL", "HIGH_LEVERAGE_TREND")
