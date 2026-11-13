"""
Tests for F-02: Bounding Box Span & Compute Complexity Protection.
Verifies enforcement of settings.MAX_BBOX_DEGREES and settings.MAX_GRID_CELLS_X_TIMESTEPS
in AnalysisRequest and CompoundHazardRequest, returning HTTP 422 with actionable guidance.
"""
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.schemas.analysis import AnalysisRequest, CompoundHazardRequest

client = TestClient(app)


def test_bbox_longitude_span_exceeding_max_degrees_raises_value_error():
    """Verify longitude span > MAX_BBOX_DEGREES is rejected."""
    # min_lon = -100.0, max_lon = 85.0 -> span = 185.0 > 180.0
    with pytest.raises(ValueError, match=r"Longitude span.*exceeds maximum allowed span"):
        AnalysisRequest(
            dataset_id="merra2_reanalysis",
            variable_id="T2M",
            start_year=2000,
            end_year=2020,
            bbox=[-100.0, 30.0, 85.0, 40.0],
        )


def test_bbox_latitude_span_exceeding_max_degrees_raises_value_error():
    """Verify latitude span > MAX_BBOX_DEGREES is rejected."""
    # When MAX_BBOX_DEGREES is customized to 90.0
    orig_max = settings.MAX_BBOX_DEGREES
    try:
        settings.MAX_BBOX_DEGREES = 45.0
        with pytest.raises(ValueError, match=r"Latitude span.*exceeds maximum allowed span"):
            AnalysisRequest(
                dataset_id="merra2_reanalysis",
                variable_id="T2M",
                start_year=2000,
                end_year=2020,
                bbox=[-100.0, 10.0, -80.0, 60.0],  # lat span 50 > 45
            )
    finally:
        settings.MAX_BBOX_DEGREES = orig_max


def test_bbox_compute_cap_exceeded_raises_value_error():
    """Verify estimated cells * time steps exceeding MAX_GRID_CELLS_X_TIMESTEPS is rejected."""
    orig_cap = settings.MAX_GRID_CELLS_X_TIMESTEPS
    try:
        # Set a low cap for deterministic testing: 1,000 cell-timesteps
        settings.MAX_GRID_CELLS_X_TIMESTEPS = 1000
        # 10° x 10° at 0.5° res = 20 x 20 = 400 cells. 400 cells * 10 years = 4,000 > 1,000
        with pytest.raises(ValueError, match=r"exceeding configured maximum"):
            AnalysisRequest(
                dataset_id="merra2_reanalysis",
                variable_id="T2M",
                start_year=2000,
                end_year=2009,
                bbox=[-100.0, 30.0, -90.0, 40.0],
            )
    finally:
        settings.MAX_GRID_CELLS_X_TIMESTEPS = orig_cap


def test_compound_hazard_request_enforces_bbox_guards():
    """Verify CompoundHazardRequest enforces identical bbox and compute guards."""
    with pytest.raises(ValueError, match=r"Longitude span.*exceeds maximum allowed span"):
        CompoundHazardRequest(
            dataset_id="merra2_reanalysis",
            temp_variable_id="T2M",
            precip_variable_id="PRECTOT",
            start_year=2000,
            end_year=2020,
            bbox=[-100.0, 30.0, 85.0, 40.0],  # 185° lon span > 180°
        )


def test_valid_bbox_passes_validation():
    """Verify reasonable regional bounding boxes pass validation without errors."""
    req = AnalysisRequest(
        dataset_id="merra2_reanalysis",
        variable_id="T2M",
        start_year=2000,
        end_year=2023,
        bbox=[-102.0, 30.0, -94.0, 38.0],
    )
    assert req.bbox == [-102.0, 30.0, -94.0, 38.0]
    assert req.alpha == settings.DEFAULT_FDR_ALPHA


def test_analysis_endpoint_returns_422_on_oversized_bbox():
    """Verify API endpoint returns HTTP 422 with explanation when bbox span exceeds limit."""
    payload = {
        "dataset_id": "merra2_reanalysis",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2020,
        "bbox": [-100.0, 30.0, 85.0, 40.0]  # 185° span > 180° limit
    }
    res = client.post("/api/v1/analysis", json=payload)
    assert res.status_code == 422
    data = res.json()
    err_text = str(data)
    assert "exceeds maximum allowed span" in err_text or "Longitude span" in err_text

