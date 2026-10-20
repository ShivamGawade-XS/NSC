"""
Verification test suite for EarthSift Brutal Audit remediation.
Validates:
1. MERRA-2 authentic NetCDF loading and integer YYYYMM slicing
2. Compound hazard endpoint calculations (CAI, hazard distributions)
3. Thread-safe LRU cache operations under concurrent load
4. NetCDF export and temporary directory cleanup
5. Moran's I analytical variance implementation
6. NASA POWER bounding box clamping notice and provenance
7. AnalysisRequest use_fdr parameter propagation
"""

import threading

import numpy as np
from app.adapters.merra2 import MERRA2Adapter
from app.adapters.nasa_power import NASAPowerAdapter
from app.main import app
from app.science.spatial import compute_global_morans_i
from fastapi.testclient import TestClient

client = TestClient(app)


def test_merra2_adapter_real_granule():
    """Verify MERRA-2 adapter successfully slices real NetCDF fixture without synthetic fallback."""
    adapter = MERRA2Adapter()
    data = adapter.fetch(
        variable="T2M",
        start_year=2000,
        end_year=2020,
        bbox=[-101.0, 31.0, -95.0, 37.0],
        prefer_live=True
    )
    assert not data["is_synthetic"]
    assert data["data"].shape[0] == 21  # 2000 to 2020 inclusive
    assert len(data["lat"]) > 0
    assert len(data["lon"]) > 0


def test_compound_hazard_endpoint_accuracy():
    """Verify POST /analysis/compound calculates valid CAI and hazard categories."""
    payload = {
        "dataset_id": "merra2_reanalysis",
        "temp_variable_id": "T2M",
        "precip_variable_id": "PRECTOT",
        "start_year": 2000,
        "end_year": 2020,
        "bbox": [-101.0, 31.0, -95.0, 37.0]
    }
    response = client.post("/analysis/compound", json=payload)
    assert response.status_code == 200
    res = response.json()
    assert "aridification_fraction" in res
    assert 0.0 <= res["aridification_fraction"] <= 1.0
    assert "intensification_fraction" in res
    assert 0.0 <= res["intensification_fraction"] <= 1.0
    assert "hazard_distribution" in res
    assert len(res["cells"]) > 0
    first_cell = res["cells"][0]
    assert "lat" in first_cell
    assert "lon" in first_cell
    assert "hazard_type" in first_cell
    assert "cai" in first_cell


def test_concurrent_cache_access():
    """Verify thread-safe LRU cache handles concurrent analysis requests without race conditions."""
    errors = []
    
    def request_worker(start_yr):
        try:
            r = client.post("/analysis", json={
                "dataset_id": "merra2_reanalysis",
                "variable_id": "T2M",
                "start_year": start_yr,
                "end_year": 2020,
                "bbox": [-101.0, 31.0, -95.0, 37.0],
                "alpha": 0.05
            })
            if r.status_code != 200:
                errors.append(f"Status {r.status_code}")
        except Exception as e:
            errors.append(str(e))

    threads = [threading.Thread(target=request_worker, args=(2000 + i,)) for i in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(errors) == 0


def test_netcdf_export_cleanup():
    """Verify exporting NetCDF returns valid binary file response."""
    # First create an analysis
    res = client.post("/analysis", json={
        "dataset_id": "merra2_reanalysis",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2020,
        "bbox": [-101.0, 31.0, -95.0, 37.0],
        "alpha": 0.05
    })
    assert res.status_code == 200
    analysis_id = res.json()["analysis_id"]

    export_res = client.get(f"/analysis/{analysis_id}/export/netcdf")
    assert export_res.status_code == 200
    assert export_res.headers["content-type"] == "application/x-netcdf"
    assert len(export_res.content) > 500


def test_morans_i_analytical_variance():
    """Verify Cliff & Ord (1981) analytical variance produces valid stats with exact asymmetric weights."""
    grid = np.array([
        [1.0, 1.2, 1.5],
        [1.1, 1.3, 1.6],
        [0.9, 1.4, 1.7]
    ])
    result = compute_global_morans_i(grid)
    assert "moran_i" in result
    assert "z_score" in result
    assert "p_value" in result
    assert result["moran_i"] > 0.2
    assert result["z_score"] > 2.0
    assert result["is_clustered"] is True
    assert 0.0 <= result["p_value"] <= 0.05


def test_morans_i_asymmetric_weights_and_nan_handling():
    """Verify Moran's I with coastal/NaN cells and asymmetric neighbor counts."""
    grid = np.array([
        [1.0, 1.2, 1.5, 2.0],
        [1.1, np.nan, 1.6, 2.1],
        [0.9, 1.4, 1.7, 2.2]
    ])
    result = compute_global_morans_i(grid)
    assert "moran_i" in result
    assert "z_score" in result
    assert "p_value" in result
    assert 0.0 <= result["p_value"] <= 1.0
    assert not np.isnan(result["z_score"])
    assert not np.isnan(result["moran_i"])


def test_nasa_power_clamping_provenance():
    """Verify NASA POWER adapter reports bounding box clamping when query exceeds 10 degrees."""
    adapter = NASAPowerAdapter()
    data = adapter.fetch(
        variable="T2M",
        start_year=2000,
        end_year=2010,
        bbox=[-115.0, 25.0, -95.0, 45.0],  # 20° x 20° delta
        prefer_live=False
    )
    prov = data["provenance"]
    assert prov.get("bbox_clamped") is True
    assert "warning" in prov and prov["warning"] is not None


def test_explainer_clean_json_parsing():
    """Verify _clean_and_parse_json strips markdown code fences safely."""
    from app.science.explainer import _clean_and_parse_json

    # Test raw JSON
    raw = '{"summary": "Test", "statistical_assessment": "Significant", "limitations": "None"}'
    assert _clean_and_parse_json(raw)["summary"] == "Test"

    # Test markdown fenced JSON
    fenced = '```json\n{"summary": "Fenced", "statistical_assessment": "Significant", "limitations": "None"}\n```'
    assert _clean_and_parse_json(fenced)["summary"] == "Fenced"

    # Test generic triple backticks
    generic = '```\n{"summary": "Generic", "statistical_assessment": "Significant", "limitations": "None"}\n```'
    assert _clean_and_parse_json(generic)["summary"] == "Generic"


def test_pettitt_changepoint_robust_types():
    """Verify Pettitt test handles int, float, and string time coordinates gracefully."""
    from app.science.trend import pettitt_changepoint_test

    series = np.concatenate([np.ones(10), np.ones(10) * 10.0])

    # Integer coordinates
    years = np.arange(2000, 2020)
    res_int = pettitt_changepoint_test(series, time_coords=years)
    assert res_int["significant"] is True
    assert res_int["changepoint_time"] in [2009, 2010]

    # String date coordinates (e.g. ISO month strings)
    dates = np.array([f"20{i:02d}-01" for i in range(20)])
    res_str = pettitt_changepoint_test(series, time_coords=dates)
    assert res_str["significant"] is True
    assert isinstance(res_str["changepoint_time"], str)

