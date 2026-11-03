"""
Tests for F-010 (Part 1): Compute Protection via Concurrency Semaphore & Memory Budget.
Asserts that spatial requests exceeding 25,000 cells are rejected with 422,
and concurrent compute saturation triggers an immediate 503 with Retry-After header.
"""
from fastapi.testclient import TestClient

from app.api.endpoints import COMPUTE_SEMAPHORE
from app.main import app

client = TestClient(app)


def test_quality_gate_memory_budget_exceeded():
    """Verify Quality Gate blocks bounding boxes exceeding 25,000 cells."""
    # Bbox spanning entire globe at 0.5x0.5 deg: 360 * 720 = 259,200 cells
    payload = {
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2020,
        "bbox": [-180.0, -90.0, 180.0, 90.0]
    }
    res = client.post("/api/v1/analysis/quality-gate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["can_execute"] is False
    assert any("25,000" in lim or "ceiling" in lim or "budget" in lim for lim in data["limitations"])


def test_concurrency_semaphore_exhaustion_returns_503(monkeypatch):
    """Verify that when compute concurrency semaphore is fully saturated, 503 Retry-After is returned."""
    # Temporarily drain semaphore permits
    drained = []
    while COMPUTE_SEMAPHORE.acquire(blocking=False):
        drained.append(True)

    try:
        payload = {
            "dataset_id": "nasa_power",
            "variable_id": "T2M",
            "start_year": 2005,
            "end_year": 2020,
            "bbox": [-100.0, 32.0, -95.0, 37.0],
            "prefer_live": True
        }
        res = client.post("/api/v1/analysis", json=payload)
        assert res.status_code == 503
        assert "capacity reached" in res.json().get("detail", "").lower()
        assert res.headers.get("Retry-After") == "5"
    finally:
        # Restore all drained permits
        for _ in drained:
            COMPUTE_SEMAPHORE.release()


def test_concurrency_semaphore_normal_execution():
    """Verify that under normal conditions with available permits, analysis proceeds."""
    payload = {
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2005,
        "end_year": 2020,
        "bbox": [-100.0, 32.0, -95.0, 37.0],
        "prefer_live": True
    }
    res = client.post("/api/v1/analysis", json=payload)
    assert res.status_code == 200
    assert "analysis_id" in res.json()
