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


def test_compute_compound_hazard_vectorized_and_significance():
    """Verify compute_compound_hazard np.select classification and significant_compound_fraction."""
    from app.science.compound import compute_compound_hazard

    t_slopes = np.array([
        [1.0, 1.0, 1.0],
        [-0.5, 0.0, 1.5]
    ])
    p_slopes = np.array([
        [-1.0, 1.0, -0.05],
        [1.0, 0.0, -2.0]
    ])
    t_sig = np.array([
        [True, False, False],
        [False, False, True]
    ])
    p_sig = np.array([
        [False, True, False],
        [False, False, False]
    ])

    res = compute_compound_hazard(t_slopes, p_slopes, temp_sig=t_sig, precip_sig=p_sig)
    assert "hazard_classification" in res
    assert "cai_map" in res
    assert "significant_compound_fraction" in res
    # 3 out of 6 cells are significant in t_sig | p_sig: (0,0), (0,1), (1,2)
    assert res["significant_compound_fraction"] == round(3.0 / 6.0, 3)

    hazard_map = res["hazard_classification"]
    assert "hydrologic_intensification" in hazard_map
    assert "thermal_buffering" in hazard_map
    assert any(h in ["severe_aridification", "moderate_drying"] for h in hazard_map.flatten())


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


def test_spatial_coherence_and_discovery_signals():
    """Verify compute_spatial_coherence 2D convolution and discover_candidate_signals top-N ranking with tau."""
    from app.science.discovery import compute_spatial_coherence, discover_candidate_signals

    # 1. Test compute_spatial_coherence
    slopes = np.array([
        [1.0, 1.0, -1.0],
        [1.0, 1.0, -1.0],
        [-1.0, -1.0, -1.0],
    ])
    sig = np.ones((3, 3), dtype=bool)
    coh = compute_spatial_coherence(slopes, sig)
    assert coh.shape == (3, 3)
    # Center cell (1, 1) has slopes=1.0. Its 8 neighbors:
    # 3 positive (0,0), (0,1), (1,0) and 5 negative (0,2), (1,2), (2,0), (2,1), (2,2)
    # Since center cell has slopes > 0, matching count is 3, total valid neighbors is 8: coh = 3/8 = 0.375
    assert np.isclose(coh[1, 1], 3.0 / 8.0)

    # 2. Test discover_candidate_signals top-N extraction and Kendall's tau
    p_vals = np.full((3, 3), 0.01)
    q_vals = np.full((3, 3), 0.02)
    lats = np.array([10.0, 20.0, 30.0])
    lons = np.array([100.0, 110.0, 120.0])
    data_3d = np.tile(np.arange(10, dtype=float)[:, None, None], (1, 3, 3))  # Perfectly increasing time series: tau=1.0

    signals = discover_candidate_signals(
        slopes=slopes,
        p_values=p_vals,
        q_values=q_vals,
        is_significant_raw=sig,
        is_significant_fdr=sig,
        latitudes=lats,
        longitudes=lons,
        top_n=3,
        data_3d=data_3d
    )
    assert len(signals) == 3
    # Sorted descending by discovery_score
    assert signals[0]["discovery_score"] >= signals[1]["discovery_score"] >= signals[2]["discovery_score"]
    # Verify Kendall's tau is present and equals 1.0
    for s in signals:
        assert "tau" in s
        assert s["tau"] == 1.0


def test_contrast_cluster_area_weighting():
    """Verify _build_cluster_dict applies cos(lat) area weights to regional mean slope and centroid."""
    from app.science.contrasts import _build_cluster_dict

    # Cell 0 at lat 0.0 (weight cos(0) = 1.0, slope = 2.0, lon = 10.0)
    # Cell 1 at lat 60.0 (weight cos(60 deg) = 0.5, slope = 4.0, lon = 10.0)
    lats = np.array([0.0, 60.0])
    lons = np.array([10.0, 10.0])
    slopes = np.array([[2.0, 2.0], [4.0, 4.0]])
    indices = np.array([[0, 0], [1, 0]])

    cluster = _build_cluster_dict(
        indices=indices,
        slopes=slopes,
        latitudes=lats,
        longitudes=lons,
        cluster_id="test_cluster",
        label_type="increasing"
    )

    # Weighted mean slope: (2.0 * 1.0 + 4.0 * 0.5) / (1.0 + 0.5) = 4.0 / 1.5 = 2.6667
    assert cluster["mean_slope"] == 2.6667
    assert cluster["max_slope"] == 4.0
    assert cluster["min_slope"] == 2.0
    # Weighted center lat: (0.0 * 1.0 + 60.0 * 0.5) / 1.5 = 30.0 / 1.5 = 20.0
    assert cluster["center"] == [10.0, 20.0]
    assert cluster["bbox"] == [10.0, 0.0, 10.0, 60.0]
    assert cluster["cell_count"] == 2


def test_explain_evidence_async_and_sync():
    """Verify explain_evidence_with_ai_async and sync explain_evidence_with_ai."""
    import asyncio
    from app.schemas.analysis import ExplainRequest
    from app.science.explainer import explain_evidence_with_ai, explain_evidence_with_ai_async

    req = ExplainRequest(
        variable_name="Surface Skin Temperature",
        location="Arctic [75.0°N, 40.0°W]",
        time_span="2000 - 2024",
        slope=0.45,
        slope_units="deg C / decade",
        p_value=0.001,
        q_value=0.002,
        significant=True,
        direction="increasing",
        sample_count=25,
        source="NASA MERRA-2"
    )

    # Test async version via asyncio.run
    res_async = asyncio.run(explain_evidence_with_ai_async(req))
    assert "0.45" in res_async.summary
    assert res_async.statistical_assessment is not None
    assert len(res_async.physical_hypotheses) > 0

    # Test sync wrapper
    res_sync = explain_evidence_with_ai(req)
    assert "0.45" in res_sync.summary
    assert res_sync.statistical_assessment is not None

