"""
Test F-04 & F-07: Parameterized FORWARDED_ALLOW_IPS and Authenticated /metrics Access.
"""
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

client = TestClient(app)


def test_forwarded_allow_ips_default_is_secure():
    """Verify default FORWARDED_ALLOW_IPS restricts to loopback and RFC1918 private ranges."""
    default_ips = settings.FORWARDED_ALLOW_IPS
    assert "*" not in default_ips
    assert "127.0.0.1" in default_ips
    assert "10.0.0.0/8" in default_ips
    assert "172.16.0.0/12" in default_ips
    assert "192.168.0.0/16" in default_ips


def test_metrics_token_mode_requires_bearer_token(monkeypatch):
    """When METRICS_TOKEN is set, require exact bearer token even from loopback/testclient."""
    token = "secret-metrics-token-alpha-99"
    monkeypatch.setenv("METRICS_TOKEN", token)

    # 1. Anonymous request without token -> 401
    res = client.get("/metrics")
    assert res.status_code == 401
    assert "METRICS_TOKEN" in res.json().get("detail", "")

    # 2. Bearer token provided -> 200
    res_auth = client.get("/metrics", headers={"Authorization": f"Bearer {token}"})
    assert res_auth.status_code == 200
    assert "service" in res_auth.json()

    # 3. Prometheus endpoint with Bearer token -> 200
    res_prom = client.get("/metrics/prometheus", headers={"Authorization": f"Bearer {token}"})
    assert res_prom.status_code == 200
    assert "tellura_http_requests_total" in res_prom.text

    # 4. Wrong bearer token -> 401
    res_wrong = client.get("/metrics", headers={"Authorization": "Bearer wrong-token"})
    assert res_wrong.status_code == 401


def test_metrics_fallback_mode_allows_private_and_loopback_clients(monkeypatch):
    """When METRICS_TOKEN is unset, allow internal listener and private network clients."""
    monkeypatch.delenv("METRICS_TOKEN", raising=False)

    # 1. Local loopback / testclient -> 200
    res = client.get("/metrics")
    assert res.status_code == 200

    # 2. External client with untrusted forwarded IP -> 401
    with patch("app.core.auth.is_internal_listener", return_value=False):
        res_ext = client.get("/metrics", headers={"X-Forwarded-For": "198.51.100.22"})
        assert res_ext.status_code == 401


def test_metrics_fallback_mode_allows_keyed_external_caller(monkeypatch):
    """When METRICS_TOKEN is unset, external caller with valid API key is allowed."""
    monkeypatch.delenv("METRICS_TOKEN", raising=False)
    api_key = "external-operator-valid-api-key"
    monkeypatch.setenv("TELLURA_API_KEYS", api_key)
    from app.core.auth import reload_api_keys
    reload_api_keys()

    with patch("app.core.auth.is_internal_listener", return_value=False):
        res = client.get("/metrics", headers={"X-API-Key": api_key})
        assert res.status_code == 200
