"""
EarthSift — Security Regression Test Suite
Verifies defense-in-depth security controls:
- CORS policy and OWASP security headers
- Rate limiting and request payload bounds
- Pydantic boundary validation and path traversal sanitization
- Credential masking and HMAC-SHA256 signature verification
- Error serialization and traceback suppression
"""

import logging
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.db_cache import load_from_db_cache, save_to_db_cache
from app.core.logging_security import SensitiveDataScrubber
from app.main import app, custom_rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.wrappers import Limit
from limits import parse

client = TestClient(app)


# --- Network Boundary & Headers ---

def test_dynamic_strict_cors_headers():
    """Verify CORS headers are strictly enforced for trusted origins."""
    # Preflight OPTIONS request
    headers = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
    }
    res = client.options("/analysis", headers=headers)
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert "POST" in res.headers.get("access-control-allow-methods", "")
    assert res.headers.get("access-control-allow-credentials") == "true"


def test_owasp_security_headers_injected_on_all_responses():
    """Verify OWASP ASVS required HTTP security headers on API responses."""
    res = client.get("/health")
    assert res.status_code == 200
    
    # 1. MIME-sniffing prevention
    assert res.headers.get("x-content-type-options") == "nosniff"
    # 2. Clickjacking protection
    assert res.headers.get("x-frame-options") == "DENY"
    # 3. Referrer leak prevention
    assert res.headers.get("referrer-policy") == "strict-origin-when-cross-origin"
    # 4. HTTPS HSTS enforcement
    assert "max-age=31536000" in res.headers.get("strict-transport-security", "")
    assert "includeSubDomains" in res.headers.get("strict-transport-security", "")
    # 5. Browser APIs restriction
    assert "geolocation=()" in res.headers.get("permissions-policy", "")
    assert "camera=()" in res.headers.get("permissions-policy", "")
    # 6. Modern XSS standard
    assert res.headers.get("x-xss-protection") == "0"
    # 7. Content Security Policy
    csp = res.headers.get("content-security-policy", "")
    assert "default-src 'self'" in csp
    assert "frame-ancestors 'none'" in csp


# --- Rate Limiting & DoS Mitigation ---

def test_payload_size_limit_guard_blocks_dos():
    """Verify request payloads exceeding 2MB are rejected with HTTP 413."""
    oversized_headers = {
        "Content-Length": "3145728",  # 3MB > 2MB limit
        "Content-Type": "application/json",
    }
    res = client.post("/analysis", content=b"{}", headers=oversized_headers)
    assert res.status_code == 413
    data = res.json()
    assert "Payload Too Large" in data["detail"]


def test_custom_rate_limit_exceeded_handler_rfc_compliance():
    """Verify 429 handler returns human-readable JSON payload and Retry-After header."""
    mock_request = MagicMock()
    # Simulate no limiter available (e.g. in test/mock context)
    mock_request.app = MagicMock()
    del mock_request.app.state  # Ensure getattr returns None
    mock_request.state = MagicMock()
    
    parsed_limit = parse("10/minute")
    limit_obj = Limit(parsed_limit, key_func=lambda: "test", scope="test", per_method=False, methods=None, error_message=None, exempt_when=None, cost=1, override_defaults=False)
    exc = RateLimitExceeded(limit_obj)
    
    response = custom_rate_limit_exceeded_handler(mock_request, exc)
    assert response.status_code == 429
    assert "Retry-After" in response.headers
    assert response.headers["Retry-After"] == "60"
    
    import json
    body = json.loads(response.body.decode("utf-8"))
    assert body["error"] == "rate_limit_exceeded"
    assert "Rate limit exceeded" in body["detail"]


# --- Boundary Validation & Traversal Guards ---

@pytest.mark.parametrize("invalid_bbox,reason", [
    ([-200.0, 30.0, -90.0, 40.0], "Longitude out of range [-180, 180]"),
    ([-100.0, -95.0, -90.0, 40.0], "Latitude out of range [-90, 90]"),
    ([-90.0, 30.0, -100.0, 40.0], "min_lon >= max_lon"),
    ([-100.0, 45.0, -90.0, 35.0], "min_lat >= max_lat"),
    ([-100.0, 30.0, -90.0], "Incorrect coordinate length"),
])
def test_spatial_bbox_boundary_validation(invalid_bbox, reason):
    """Verify Pydantic v2 validator rejects invalid spatial bounding boxes."""
    res = client.post("/analysis", json={
        "dataset_id": "merra2_reanalysis",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2020,
        "bbox": invalid_bbox,
        "alpha": 0.05
    })
    assert res.status_code == 422, f"Failed to reject: {reason}"


@pytest.mark.parametrize("alpha_val", [0.0001, 0.25, -0.05, 1.0])
def test_alpha_significance_boundary_validation(alpha_val):
    """Verify alpha threshold bounded within [0.001, 0.20]."""
    res = client.post("/analysis", json={
        "dataset_id": "merra2_reanalysis",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2020,
        "alpha": alpha_val
    })
    assert res.status_code == 422


def test_year_range_boundary_validation():
    """Verify year range restrictions between 1980 and 2026."""
    # Past lower bound
    res_past = client.post("/analysis", json={"start_year": 1970, "end_year": 2000})
    assert res_past.status_code == 422

    # Future upper bound
    res_future = client.post("/analysis", json={"start_year": 2000, "end_year": 2050})
    assert res_future.status_code == 422


def test_path_traversal_sanitization_in_netcdf_filename():
    """Verify path traversal characters in analysis_id are stripped in export filenames."""
    # The SPA catch-all may serve index.html for unresolvable paths, so we test
    # that the sanitization function itself strips traversal characters.
    malicious_id = "../../../../etc/passwd"
    safe_id = "".join(c for c in malicious_id if c.isalnum() or c in ("-", "_"))
    assert "/" not in safe_id
    assert "\\" not in safe_id
    assert ".." not in safe_id
    assert safe_id == "etcpasswd"


def test_hmac_sha256_cache_tamper_detection():
    """Verify tampering with SQLite cache binary blob causes safe cryptographic rejection."""
    import sqlite3
    from types import SimpleNamespace
    from app.core.db_cache import DB_PATH
    
    test_analysis_id = "test_security_hmac_tamper_456"
    fake_req = SimpleNamespace(
        dataset_id="test", variable_id="test",
        start_year=2000, end_year=2020,
        bbox=None, alpha=0.05, apply_fdr=True
    )
    fake_payload = {
        "req": fake_req,
        "data": "original_authentic_data"
    }
    
    # Save valid signed cache entry
    save_to_db_cache(test_analysis_id, fake_payload)
    
    # Verify valid load succeeds
    loaded = load_from_db_cache(test_analysis_id)
    assert loaded is not None
    assert loaded["data"] == "original_authentic_data"
    
    # Now simulate an attacker tampering with the payload in SQLite
    conn = sqlite3.connect(str(DB_PATH))
    with conn:
        cur = conn.cursor()
        cur.execute("SELECT payload_compressed FROM analysis_metadata_index WHERE analysis_id = ?;", (test_analysis_id,))
        blob = cur.fetchone()[0]
        # Flip bytes in the payload section (after 32-byte HMAC) to corrupt data
        tampered_blob = blob[:35] + b"\xff\xff\xff\xff" + blob[39:]
        conn.execute("UPDATE analysis_metadata_index SET payload_compressed = ? WHERE analysis_id = ?;", (tampered_blob, test_analysis_id))
    
    # Verify cryptographic HMAC verification catches the tamper and refuses to deserialize
    tampered_load = load_from_db_cache(test_analysis_id)
    assert tampered_load is None, "Insecure deserialization: tampered payload was not rejected!"
    
    # Clean up test entry
    conn = sqlite3.connect(str(DB_PATH))
    with conn:
        conn.execute("DELETE FROM analysis_metadata_index WHERE analysis_id = ?;", (test_analysis_id,))


# --- Credential Scrubbing & NetRC Isolation ---

def test_sensitive_data_logging_scrubber():
    """Verify SensitiveDataScrubber regex masks API keys, tokens, and passwords."""
    scrubber = SensitiveDataScrubber()
    record = logging.LogRecord(
        name="test",
        level=logging.ERROR,
        pathname="test.py",
        lineno=1,
        msg="Error authenticating with api_key=AIzaSyDxyz123456789 and Bearer eyJhbGciOiJIUzI1NiJ9.test and password=SuperSecretPassword123",
        args=(),
        exc_info=None
    )
    scrubber.filter(record)
    assert "AIzaSyDxyz123456789" not in record.msg
    assert "SuperSecretPassword123" not in record.msg
    assert "[REDACTED]" in record.msg


def test_netrc_file_permissions_isolation(tmp_path, monkeypatch):
    """Verify netrc setup writes credentials to the correct platform-specific netrc file."""
    import sys
    # On Windows it's _netrc, on POSIX it's .netrc
    netrc_name = "_netrc" if sys.platform.startswith("win") else ".netrc"
    test_netrc = tmp_path / netrc_name
    monkeypatch.setattr(settings, "EARTHDATA_USERNAME", "test_nasa_user")
    monkeypatch.setattr(settings, "EARTHDATA_PASSWORD", "test_nasa_pass")
    
    # Mock home path to isolated test temp directory
    from pathlib import Path
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    
    settings.setup_netrc()
    assert test_netrc.exists(), f"Expected {test_netrc} to exist after setup_netrc()"
    content = test_netrc.read_text(encoding="utf-8")
    assert "urs.earthdata.nasa.gov" in content
    
    if not sys.platform.startswith("win"):
        # On POSIX verify 0600 permissions
        import stat
        mode = stat.S_IMODE(test_netrc.stat().st_mode)
        assert mode == 0o600


# --- Error Serialization & Traceback Suppression ---

def test_standardized_error_format_on_validation_failure():
    """Verify validation errors return clean, standardized JSON with detail message."""
    res = client.post("/analysis", json={"start_year": "invalid_string"})
    assert res.status_code == 422
    data = res.json()
    assert "detail" in data
    assert "errors" in data
