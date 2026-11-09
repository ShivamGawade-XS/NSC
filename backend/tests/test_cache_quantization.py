"""
Verification tests for DEF-003: Sub-degree bounding box quantization,
alpha tolerance quantization, FDR separation in cache keys, and Z-score inclusion.
"""

from fastapi.testclient import TestClient

from app.api.endpoints import _generate_analysis_id
from app.main import app
from app.schemas.analysis import AnalysisRequest

client = TestClient(app)


def test_sub_degree_bbox_cache_key_uniqueness():
    """Verify sub-degree bboxes do not collide through integer truncation."""
    req1 = AnalysisRequest(
        dataset_id="merra2_reanalysis",
        variable_id="T2M",
        start_year=2000,
        end_year=2020,
        bbox=[-100.25, 30.5, -90.75, 45.25],
        alpha=0.05,
        use_fdr=True
    )
    req2 = AnalysisRequest(
        dataset_id="merra2_reanalysis",
        variable_id="T2M",
        start_year=2000,
        end_year=2020,
        bbox=[-100.8, 30.1, -90.2, 45.9],
        alpha=0.05,
        use_fdr=True
    )
    id1 = _generate_analysis_id(req1)
    id2 = _generate_analysis_id(req2)
    assert id1 != id2, f"Sub-degree bboxes must produce distinct cache IDs: {id1} vs {id2}"
    assert "b-100.25_30.5_-90.75_45.25" in id1
    assert "b-100.8_30.1_-90.2_45.9" in id2


def test_alpha_quantization_cache_bust_defense():
    """Verify micro-variations in alpha collapse into the same quantized cache key."""
    req_a = AnalysisRequest(
        dataset_id="merra2_reanalysis",
        variable_id="T2M",
        start_year=2000,
        end_year=2020,
        bbox=[-120.0, 30.0, -90.0, 45.0],
        alpha=0.0499991,
        use_fdr=True
    )
    req_b = AnalysisRequest(
        dataset_id="merra2_reanalysis",
        variable_id="T2M",
        start_year=2000,
        end_year=2020,
        bbox=[-120.0, 30.0, -90.0, 45.0],
        alpha=0.0500002,
        use_fdr=True
    )
    id_a = _generate_analysis_id(req_a)
    id_b = _generate_analysis_id(req_b)
    assert id_a == id_b, f"Micro-variations in alpha must quantize identically: {id_a} vs {id_b}"
    assert "a50" in id_a


def test_fdr_vs_raw_distinct_cache_keys():
    """Verify use_fdr=False appends _raw suffix to guarantee isolation."""
    req_fdr = AnalysisRequest(
        dataset_id="merra2_reanalysis",
        variable_id="T2M",
        start_year=2000,
        end_year=2020,
        bbox=[-120.0, 30.0, -90.0, 45.0],
        alpha=0.05,
        use_fdr=True
    )
    req_raw = AnalysisRequest(
        dataset_id="merra2_reanalysis",
        variable_id="T2M",
        start_year=2000,
        end_year=2020,
        bbox=[-120.0, 30.0, -90.0, 45.0],
        alpha=0.05,
        use_fdr=False
    )
    id_fdr = _generate_analysis_id(req_fdr)
    id_raw = _generate_analysis_id(req_raw)
    assert id_fdr != id_raw
    assert id_raw.endswith("_raw")
    assert not id_fdr.endswith("_raw")


def test_cell_timeseries_returns_standardized_z():
    """Verify /analysis/{id}/cell includes standardized z score from Mann-Kendall."""
    # Run analysis
    res = client.post("/analysis", json={
        "dataset_id": "merra2_reanalysis",
        "variable_id": "T2M",
        "start_year": 2005,
        "end_year": 2018,
        "alpha": 0.05,
        "bbox": [-115.0, 32.0, -100.0, 42.0]
    })
    assert res.status_code == 200
    analysis_id = res.json()["analysis_id"]

    # Query cell detail
    cell_res = client.get(f"/analysis/{analysis_id}/cell?lat=35.0&lon=-110.0")
    assert cell_res.status_code == 200
    data = cell_res.json()
    assert "z" in data
    assert data["z"] is not None
    assert isinstance(data["z"], float)
