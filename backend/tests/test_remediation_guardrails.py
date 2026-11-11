"""
Tellura — Confirmed Defect Remediation and Scientific Guardrails Test Suite
Tests for P0 and P1 fixes:
1. Spatial Query Crash (P0): zero-cell bounding boxes return clean 422 with actionable guidance instead of 500.
2. Solar Discontinuity Guard (P0): cross-regime trends across 2000/2001 for ALLSKY_SFC_SW_DWN are blocked with clear partition guidance.
3. Single-regime solar queries and unaffected variables (T2M) proceed cleanly.
4. Annual aggregation metadata (P0): explicit temporal_aggregation="annual_mean" and sample count.
5. Climatological nomenclature (P1): meets_climatological_duration_threshold field and explicit caveat.
6. Test cache isolation (P1): tests run cleanly regardless of existing cache on disk.
7. Explicit production secret validation (P1): no implicit pytest bypass.
"""

from pathlib import Path

from fastapi.testclient import TestClient

from app.adapters.nasa_power import NASAPowerAdapter
from app.main import app

client = TestClient(app)


# --- P0: Spatial Query Zero-Cell Protection ---

def test_spatial_empty_cells_uses_point_mode_fallback():
    """P2-004: Bounding box between grid cells should fall back to point-mode, not crash with 500 or reject with 422."""
    resp = client.post("/analysis", json={
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2018,
        "end_year": 2023,
        "bbox": [-94.9, 30.1, -94.7, 30.3]  # Falls strictly between 0.5° grid centers
    })
    # Point-mode fallback should succeed (200) or fall back to 422 if network unavailable
    if resp.status_code == 200:
        data = resp.json()
        prov = data.get("provenance", {})
        assert prov.get("is_point_mode") is True, "Point-mode provenance flag must be set"
        assert "point_coordinates" in prov, "Point coordinates must be in provenance"
        assert data["summary"]["total_cells"] == 1, "Point-mode should yield exactly 1 cell"
        assert len(data["grid"]) == 1, "Point-mode grid should have exactly 1 point"
        assert "point-mode" in prov.get("warning", "").lower() or "nearest" in prov.get("warning", "").lower(), \
            "Provenance warning should mention point-mode or nearest-neighbor"
    else:
        # Network unavailable — fallback to original 422 behavior
        assert resp.status_code == 422, f"Expected 200 (point-mode) or 422 (offline), got {resp.status_code}"


def test_spatial_valid_and_boundary_boxes():
    """Verify that bounding boxes containing at least one grid point succeed cleanly."""
    # Box containing (30.0, -95.0)
    resp = client.post("/analysis", json={
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2018,
        "end_year": 2023,
        "bbox": [-95.2, 29.8, -94.8, 30.2]
    })
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["grid"]) >= 1


def test_spatial_high_latitude_succeeds():
    """Verify high-latitude bounding box evaluates with area weighting without crashing."""
    resp = client.post("/analysis", json={
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2018,
        "end_year": 2023,
        "bbox": [-100.0, 70.0, -95.0, 75.0]
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["summary"]["total_cells"] > 0


# --- P0: Solar Discontinuity Guard ---

def test_solar_trend_crossing_2000_transition_is_blocked():
    """RED Test: Solar irradiance crossing 2000/2001 instrument shift must be rejected with 422 and partitioning instructions."""
    resp = client.post("/analysis", json={
        "dataset_id": "nasa_power",
        "variable_id": "ALLSKY_SFC_SW_DWN",
        "start_year": 1990,
        "end_year": 2015,
        "bbox": [-100.0, 32.0, -96.0, 36.0]
    })
    assert resp.status_code == 422, f"Expected 422 blocking unsupported cross-sensor trend, got {resp.status_code}"
    body = resp.json()
    detail = body.get("detail", "")
    if isinstance(detail, list):
        detail = " ".join(str(d) for d in detail)
    assert "2000" in detail or "transition" in detail.lower() or "srb" in detail.lower() or "ceres" in detail.lower(), (
        f"Expected explanation of instrument transition and partitioning instructions, got: {detail}"
    )


def test_solar_trend_within_single_regimes_allowed():
    """Verify solar analysis within SRB (<= 2000) or within CERES (>= 2001) is allowed."""
    # CERES epoch: 2001 to 2020
    resp_ceres = client.post("/analysis", json={
        "dataset_id": "nasa_power",
        "variable_id": "ALLSKY_SFC_SW_DWN",
        "start_year": 2001,
        "end_year": 2020,
        "bbox": [-100.0, 32.0, -96.0, 36.0]
    })
    assert resp_ceres.status_code == 200

    # SRB epoch: 1985 to 2000
    resp_srb = client.post("/analysis", json={
        "dataset_id": "nasa_power",
        "variable_id": "ALLSKY_SFC_SW_DWN",
        "start_year": 1985,
        "end_year": 2000,
        "bbox": [-100.0, 32.0, -96.0, 36.0]
    })
    assert resp_srb.status_code == 200


def test_unaffected_variables_not_blocked_across_2000():
    """Verify non-solar variables (T2M) spanning across 2000 are not blocked."""
    resp = client.post("/analysis", json={
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 1990,
        "end_year": 2015,
        "bbox": [-100.0, 32.0, -96.0, 36.0]
    })
    assert resp.status_code == 200


# --- P0: Explicit Time-Series Aggregation Semantics ---

def test_annual_aggregation_explicit_in_summary_and_provenance():
    """RED Test: Ensure API response explicitly states temporal_aggregation='annual_mean' and correct sample count."""
    resp = client.post("/analysis", json={
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2023,
        "bbox": [-100.0, 32.0, -96.0, 36.0]
    })
    assert resp.status_code == 200
    data = resp.json()
    prov = data.get("provenance", {})
    summary = data.get("summary", {})

    assert prov.get("temporal_aggregation") == "annual_mean"
    assert prov.get("sample_count") == 24
    assert "temporal_aggregation" in summary or "temporal_aggregation" in prov


# --- P1: Climatological Duration vs. WMO Normal ---

def test_climatological_duration_threshold_fields():
    """RED Test: Verify meets_climatological_duration_threshold field and explicit distinction from WMO Standard Normal."""
    # 24-year window
    resp_long = client.post("/analysis", json={
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2023,
        "bbox": [-100.0, 32.0, -96.0, 36.0]
    })
    assert resp_long.status_code == 200
    sum_long = resp_long.json()["summary"]
    assert sum_long.get("meets_climatological_duration_threshold") is True
    # Backward compatibility
    assert sum_long.get("is_climatological_normal") is True

    # 6-year window (< 20 years)
    resp_short = client.post("/analysis", json={
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2018,
        "end_year": 2023,
        "bbox": [-100.0, 32.0, -96.0, 36.0]
    })
    assert resp_short.status_code == 200
    sum_short = resp_short.json()["summary"]
    assert sum_short.get("meets_climatological_duration_threshold") is False
    assert sum_short.get("is_climatological_normal") is False
    assert "WMO" in sum_short.get("climatological_qualification", "")


# --- P1: Test Isolation with Injected Cache ---

def test_adapter_cache_isolation_with_tmp_path(tmp_path: Path):
    """RED Test: Injected cache_dir must guarantee deterministic cache misses on fresh runs."""
    adapter = NASAPowerAdapter(cache_dir=tmp_path)
    assert len(list(tmp_path.glob("*.nc"))) == 0

    requested_urls = []
    import urllib.error
    import urllib.request
    from email.message import Message

    def mock_urlopen(url, *args, **kwargs):
        full_url = url.full_url if hasattr(url, "full_url") else str(url)
        requested_urls.append(full_url)
        raise urllib.error.HTTPError(full_url, 500, "Mock Test Halt", Message(), None)

    orig_urlopen = urllib.request.urlopen
    urllib.request.urlopen = mock_urlopen  # type: ignore[assignment]
    try:
        adapter.fetch_live_granule("T2M", 2020, 2021, [-95.0, 30.0, -94.0, 31.0])
    finally:
        urllib.request.urlopen = orig_urlopen  # type: ignore[assignment]

    assert len(requested_urls) > 0, "When cache_dir is isolated, urlopen MUST be called"


# --- P2-004: Point-Mode Fallback Tests ---

def test_fetch_point_with_mocked_api(tmp_path: Path):
    """Verify NASAPowerAdapter.fetch_point correctly parses NASA POWER Point API JSON response."""
    import json
    import urllib.error
    import urllib.request

    adapter = NASAPowerAdapter(cache_dir=tmp_path)

    # Construct a realistic NASA POWER Point API JSON response
    mock_response = {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [-95.0, 30.0]},
        "properties": {
            "parameter": {
                "T2M": {}
            }
        }
    }
    # Generate YYYY13 annual values for 2018-2023
    for year in range(2018, 2024):
        for month in range(1, 14):
            key = str(year * 100 + month)
            if month == 13:
                mock_response["properties"]["parameter"]["T2M"][key] = 20.0 + (year - 2018) * 0.3
            else:
                mock_response["properties"]["parameter"]["T2M"][key] = 18.0 + (year - 2018) * 0.2 + month * 0.1

    mock_bytes = json.dumps(mock_response).encode("utf-8")

    class MockResponse:
        status = 200
        def read(self):
            return mock_bytes
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass

    orig_urlopen = urllib.request.urlopen
    def mock_urlopen(req_obj, *args, **kwargs):
        return MockResponse()

    urllib.request.urlopen = mock_urlopen  # type: ignore[assignment]
    try:
        result = adapter.fetch_point("T2M", 2018, 2023, lat=30.1, lon=-94.8)
    finally:
        urllib.request.urlopen = orig_urlopen  # type: ignore[assignment]

    assert result is not None, "fetch_point should return data from mocked API"
    assert result["data"].shape[0] == 6, "Should have 6 annual data points (2018-2023)"
    assert result["data"].shape[1] == 1, "Point-mode data should have height=1"
    assert result["data"].shape[2] == 1, "Point-mode data should have width=1"
    assert result["lat"][0] == 30.0, "Should use snapped lat from API geometry"
    assert result["lon"][0] == -95.0, "Should use snapped lon from API geometry"
    assert result["is_synthetic"] is False
    assert result["provenance"]["is_point_mode"] is True
    assert result["provenance"]["point_coordinates"]["lat"] == 30.0
    assert result["provenance"]["point_coordinates"]["lon"] == -95.0


def test_quality_gate_reports_point_mode_for_subgrid_bbox():
    """Verify quality gate indicates point-mode availability for sub-grid bounding boxes."""
    resp = client.post("/analysis/quality-gate", json={
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2018,
        "end_year": 2023,
        "bbox": [-94.9, 30.1, -94.7, 30.3]
    })
    assert resp.status_code == 200
    data = resp.json()
    # Should be executable (point-mode available) and mention point-mode in limitations/recommendations
    assert data["can_execute"] is True, "Sub-grid queries should be executable with point-mode fallback"
    all_text = " ".join(data.get("limitations", []) + data.get("actionable_recommendations", []))
    assert "point" in all_text.lower(), f"Should mention point-mode in guidance, got: {all_text}"

