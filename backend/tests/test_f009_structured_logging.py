"""
Unit & Integration Tests for F-009:
- W3C traceparent propagation and child span ID generation
- X-Correlation-ID extraction, propagation, and fallback generation
- Single-line JSON log formatting with correlation metadata
- HTTP request/response header verification
- Credential scrubbing within structured logs
"""

import json
import logging
from unittest.mock import MagicMock

import pytest
from starlette.testclient import TestClient

from app.core.logging_security import (
    CORRELATION_ID_CTX,
    SPAN_ID_CTX,
    TRACE_ID_CTX,
    JSONLogFormatter,
    SensitiveDataScrubber,
    get_current_correlation_id,
    get_current_trace_id,
)
from app.main import app

client = TestClient(app)


def test_custom_correlation_id_propagated_to_response():
    """Verify incoming X-Correlation-ID header is echoed back on HTTP responses."""
    custom_corr = "req_spaceapps_987654321"
    response = client.get("/ready", headers={"X-Correlation-ID": custom_corr})
    assert response.status_code == 200
    assert response.headers.get("x-correlation-id") == custom_corr


def test_missing_correlation_id_generates_prefixed_id():
    """Verify requests lacking correlation IDs receive a generated corr_* header."""
    response = client.get("/ready")
    assert response.status_code == 200
    corr = response.headers.get("x-correlation-id")
    assert corr is not None
    assert corr.startswith("corr_")


def test_w3c_traceparent_parsed_and_child_span_returned():
    """Verify valid W3C traceparent (00-trace_id-parent_span-01) preserves trace_id with fresh span_id."""
    incoming_trace_id = "4bf92f3577b34da6a3ce929d0e0e4736"
    parent_span_id = "00f067aa0ba902b7"
    incoming_tp = f"00-{incoming_trace_id}-{parent_span_id}-01"

    response = client.get("/ready", headers={"traceparent": incoming_tp})
    assert response.status_code == 200
    outgoing_tp = response.headers.get("traceparent")
    assert outgoing_tp is not None
    parts = outgoing_tp.split("-")
    assert len(parts) == 4
    assert parts[0] == "00"
    assert parts[1] == incoming_trace_id
    assert parts[2] != parent_span_id  # Child span generated
    assert len(parts[2]) == 16
    assert parts[3] == "01"


def test_missing_traceparent_generates_valid_w3c_header():
    """Verify request without traceparent receives a newly minted W3C header."""
    response = client.get("/ready")
    outgoing_tp = response.headers.get("traceparent")
    assert outgoing_tp is not None
    parts = outgoing_tp.split("-")
    assert len(parts) == 4
    assert parts[0] == "00"
    assert len(parts[1]) == 32
    assert len(parts[2]) == 16
    assert parts[3] == "01"


def test_json_log_formatter_outputs_valid_json_with_tracing_and_scrubbing():
    """Verify JSONLogFormatter outputs single-line JSON, includes correlation IDs, and scrubs secrets."""
    formatter = JSONLogFormatter()
    scrubber = SensitiveDataScrubber()

    token_corr = CORRELATION_ID_CTX.set("test_corr_12345")
    token_trace = TRACE_ID_CTX.set("abcdef0123456789abcdef0123456789")
    token_span = SPAN_ID_CTX.set("1234567890abcdef")

    try:
        record = logging.LogRecord(
            name="earthsift.test",
            level=logging.INFO,
            pathname="test.py",
            lineno=42,
            msg="Connected with api_key=AIzaSySuperSecretKey123456 and token=ghp_token999999",
            args=(),
            exc_info=None,
        )
        record.path = "/api/v1/analysis"
        record.method = "POST"
        record.status_code = 200
        record.duration_ms = 45.2
        record.client_ip = "127.0.0.1"

        scrubber.filter(record)
        formatted_str = formatter.format(record)

        # Must be valid single-line JSON
        assert "\n" not in formatted_str
        payload = json.loads(formatted_str)

        assert payload["level"] == "INFO"
        assert payload["logger"] == "earthsift.test"
        assert payload["correlation_id"] == "test_corr_12345"
        assert payload["trace_id"] == "abcdef0123456789abcdef0123456789"
        assert payload["span_id"] == "1234567890abcdef"
        assert payload["path"] == "/api/v1/analysis"
        assert payload["method"] == "POST"
        assert payload["status_code"] == 200
        assert payload["duration_ms"] == 45.2
        assert payload["client_ip"] == "127.0.0.1"

        # Check sensitive credentials were redacted
        assert "AIzaSySuperSecretKey123456" not in payload["message"]
        assert "ghp_token999999" not in payload["message"]
        assert "[REDACTED]" in payload["message"]
    finally:
        CORRELATION_ID_CTX.reset(token_corr)
        TRACE_ID_CTX.reset(token_trace)
        SPAN_ID_CTX.reset(token_span)
