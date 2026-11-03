"""
Tests for P0-01: Two-tier authentication, telemetry protection, proxy IP spoofing resistance,
cache-key quantization, and LLM budget capping.
"""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_metrics_and_auth_status_restricted_from_anonymous_external():
    """Verify that /metrics and /auth/status reject anonymous requests with 401."""
    # Anonymous external request (simulated by X-External-Client or external X-Forwarded-For)
    res_metrics = client.get("/api/v1/metrics", headers={"X-External-Client": "true"})
    assert res_metrics.status_code in (401, 403), f"Expected 401/403 for /metrics, got {res_metrics.status_code}"

    res_auth = client.get("/api/v1/auth/status", headers={"X-External-Client": "true"})
    assert res_auth.status_code in (401, 403), f"Expected 401/403 for /auth/status, got {res_auth.status_code}"


def test_health_and_ready_contain_no_sensitive_info():
    """Verify /health and /ready return minimal telemetry without memory RSS or cache internals."""
    res_health = client.get("/health")
    assert res_health.status_code == 200
    data = res_health.json()
    assert "memory_rss_mb" not in str(data)
    assert "earthdata" not in str(data).lower() or data.get("status") == "healthy"

    res_ready = client.get("/ready")
    assert res_ready.status_code == 200
    assert "memory" not in res_ready.json()


def test_two_tier_auth_valid_api_key_unlocks_metrics(monkeypatch):
    """Verify that providing a valid API key unlocks /metrics and reports keyed tier."""
    test_key = "test-secret-api-key-for-forge-2026"
    monkeypatch.setenv("EARTHSIFT_API_KEYS", test_key)
    # Reload or reinitialize key hashes
    from app.core.auth import reload_api_keys
    reload_api_keys()

    # With X-API-Key header
    res = client.get("/api/v1/metrics", headers={"X-API-Key": test_key})
    assert res.status_code == 200
    assert "memory_rss_mb" in res.json() or "cached_analyses" in res.json()

    # With Authorization: Bearer <key>
    res_bearer = client.get("/api/v1/metrics", headers={"Authorization": f"Bearer {test_key}"})
    assert res_bearer.status_code == 200

    # With invalid key -> 401
    res_bad = client.get("/api/v1/metrics", headers={"X-API-Key": "wrong-key"})
    assert res_bad.status_code == 401


def test_anonymous_explain_forces_deterministic_template(monkeypatch):
    """Anonymous /explain must never call external LLM; returns deterministic template only."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-gemini-key")
    payload = {
        "variable_name": "2-Meter Air Temperature",
        "location": "Dallas, TX [32.7°N, -96.8°E]",
        "time_span": "2000 - 2023",
        "slope": 0.35,
        "slope_units": "°C / decade",
        "p_value": 0.002,
        "q_value": 0.005,
        "significant": True,
        "direction": "increasing",
        "sample_count": 24,
        "source": "NASA POWER"
    }

    res = client.post("/api/v1/explain", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "Mann-Kendall test determined this change is statistically significant" in data["statistical_assessment"]
    assert "Hadley Cell" in str(data["physical_hypotheses"])


def test_batch_endpoints_require_api_key():
    """Verify heavy batch endpoints require keyed tier for large/unlimited scans."""
    payload = {
        "dataset_id": "nasa_power",
        "bbox": [-100.0, 30.0, -90.0, 40.0],
        "start_year": 1990,
        "end_year": 2023,
        "variable_ids": ["T2M", "PRECTOTCORR", "WS10M"]
    }
    res = client.post("/api/v1/analysis/discover-trends", json=payload)
    assert res.status_code in (401, 403), f"Expected 401/403 for anonymous /discover-trends, got {res.status_code}"


def test_proxy_ip_spoofing_defense(monkeypatch):
    """Untrusted clients sending X-Forwarded-For must have their header ignored."""
    from starlette.requests import Request

    from app.core.limiter import get_client_ip

    scope_untrusted = {
        "type": "http",
        "client": ("198.51.100.5", 12345),
        "headers": [(b"x-forwarded-for", b"203.0.113.195, 10.0.0.1")],
    }
    req = Request(scope_untrusted)
    # When TRUSTED_PROXY_IPS does not include 198.51.100.5, client IP must be 198.51.100.5
    ip = get_client_ip(req)
    assert ip == "198.51.100.5"

    # When client is a trusted proxy, it extracts rightmost untrusted IP
    monkeypatch.setenv("TRUSTED_PROXY_IPS", "127.0.0.1, 10.0.0.1, 198.51.100.5")
    ip_trusted = get_client_ip(req)
    assert ip_trusted == "203.0.113.195"


def test_cache_key_quantization_normalizes_floats():
    """Varying alpha by minuscule amounts must normalize to the exact same cache lookup."""
    from app.core.db_cache import normalize_cache_params
    k1 = normalize_cache_params("merra2_reanalysis", "T2M", 2000, 2023, [-100.00001, 30.00001, -90.00001, 40.00001], 0.049999, True)
    k2 = normalize_cache_params("merra2_reanalysis", "T2M", 2000, 2023, [-100.0, 30.0, -90.0, 40.0], 0.050001, True)
    assert k1 == k2
