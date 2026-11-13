"""
Unit & Integration Tests for Prometheus Observability:
- GET /metrics/prometheus and GET /api/v1/metrics/prometheus endpoint responses
- Two-tier authentication authorization on Prometheus metrics
- Counter and histogram metric recording
- System memory gauge updates
- Cardinality safety normalization
"""

from unittest.mock import patch

from starlette.testclient import TestClient

from app.core.telemetry import (
    normalize_metric_endpoint,
)
from app.main import app

client = TestClient(app)


def test_normalize_metric_endpoint_cardinality_safety():
    """Verify endpoint normalizer collapses UUIDs and IDs to prevent metric cardinality explosion."""
    assert normalize_metric_endpoint("/api/v1/analysis/a1b2c3d4-e5f6-7890-abcd-ef0123456789") == "/analysis/{id}"
    assert normalize_metric_endpoint("/analysis/12345678-1234-1234-1234-123456789abc") == "/analysis/{id}"
    assert normalize_metric_endpoint("/export/latex") == "/export/{type}"
    assert normalize_metric_endpoint("/export/jupyter") == "/export/{type}"
    assert normalize_metric_endpoint("/ready") == "/ready"


def test_prometheus_endpoint_internal_listener_success():
    """Verify Prometheus scrape succeeds from loopback / testclient client."""
    response = client.get("/metrics/prometheus")
    assert response.status_code == 200
    assert "text/plain" in response.headers.get("content-type", "")
    content = response.text
    assert "tellura_http_requests_total" in content
    assert "tellura_http_request_duration_seconds" in content
    assert "tellura_process_memory_rss_bytes" in content


def test_prometheus_endpoint_anonymous_external_rejected():
    """Verify external untrusted client without API key receives 401/403 on Prometheus endpoint."""
    with patch("app.core.auth.is_internal_listener", return_value=False):
        response = client.get("/metrics/prometheus", headers={"X-Forwarded-For": "203.0.113.195"})
        assert response.status_code in (401, 403)
        data = response.json()
        assert "valid API key" in data.get("detail", "")


def test_prometheus_endpoint_keyed_external_allowed(monkeypatch):
    """Verify external client WITH valid API key receives 200 OK on Prometheus endpoint."""
    test_key = "test_api_key_earthdata_2026"
    monkeypatch.setenv("TELLURA_API_KEYS", test_key)
    from app.core.auth import reload_api_keys
    reload_api_keys()

    with patch("app.core.auth.is_internal_listener", return_value=False):
        response = client.get(
            "/metrics/prometheus",
            headers={
                "X-Forwarded-For": "203.0.113.195",
                "X-API-Key": test_key,
            },
        )
        assert response.status_code == 200
        assert "tellura_http_requests_total" in response.text
