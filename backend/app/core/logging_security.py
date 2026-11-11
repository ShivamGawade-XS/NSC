"""
NASA Tellura — Security Logging Sanitizer & Distributed Tracing Middleware
Applies regex scrubbing across application logs to prevent accidental leakage
of API keys, tokens, and credentials. Implements W3C TraceContext (traceparent)
and X-Correlation-ID propagation with structured JSON formatting (ASVS 8.3.1 / Google SRE PRR).
"""

import contextlib
import json
import logging
import os
import re
import secrets
import time
import traceback
from contextvars import ContextVar
from typing import Any

from starlette.types import Message, Receive, Scope, Send

# Distributed tracing & request correlation context variables
CORRELATION_ID_CTX: ContextVar[str] = ContextVar("correlation_id", default="")
TRACE_ID_CTX: ContextVar[str] = ContextVar("trace_id", default="")
SPAN_ID_CTX: ContextVar[str] = ContextVar("span_id", default="")

# W3C traceparent regex: 00-{32-hex-trace-id}-{16-hex-parent-id}-{2-hex-flags}
TRACEPARENT_REGEX = re.compile(r"^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$", re.IGNORECASE)
SAFE_CORRELATION_ID_REGEX = re.compile(r"^[a-zA-Z0-9_\-\.]{1,64}$")


def get_current_correlation_id() -> str:
    """Return active correlation ID from request context."""
    return CORRELATION_ID_CTX.get() or ""


def get_current_trace_id() -> str:
    """Return active W3C trace ID from request context."""
    return TRACE_ID_CTX.get() or ""


def get_current_span_id() -> str:
    """Return active span ID from request context."""
    return SPAN_ID_CTX.get() or ""


SENSITIVE_PATTERNS: list[tuple[re.Pattern, str]] = [
    # URL basic authentication credentials (e.g. https://user:password@hostname/...)
    (re.compile(r"(https?://[^:\s/]+:)([^@\s/]+)(@)", re.IGNORECASE), r"\1[REDACTED]\3"),
    # NASA Earthdata credentials and application secret keys
    (re.compile(r"(EARTHDATA_TOKEN\s*[:=]\s*)(['\"]?[^\s,'\"]+['\"]?)", re.IGNORECASE), r"\1[REDACTED]"),
    (re.compile(r"(EARTHDATA_PASSWORD\s*[:=]\s*)(['\"]?[^\s,'\"]+['\"]?)", re.IGNORECASE), r"\1[REDACTED]"),
    (re.compile(r"(SECRET_KEY\s*[:=]\s*)(['\"]?[^\s,'\"]+['\"]?)", re.IGNORECASE), r"\1[REDACTED]"),
    # Generic API keys, tokens, and passwords
    (re.compile(r"(api[-_]?key\s*[:=]\s*)(['\"]?[a-zA-Z0-9_\-]{8,}['\"]?)", re.IGNORECASE), r"\1[REDACTED]"),
    (re.compile(r"(password\s*[:=]\s*)(['\"]?[^\s,'\"]+['\"]?)", re.IGNORECASE), r"\1[REDACTED]"),
    (re.compile(r"(token\s*[:=]\s*)(['\"]?[a-zA-Z0-9_\-\.]{8,}['\"]?)", re.IGNORECASE), r"\1[REDACTED]"),
    (re.compile(r"(secret\s*[:=]\s*)(['\"]?[a-zA-Z0-9_\-]{8,}['\"]?)", re.IGNORECASE), r"\1[REDACTED]"),
    (re.compile(r"(Bearer\s+)([a-zA-Z0-9_\-\.]{10,})", re.IGNORECASE), r"\1[REDACTED]"),
    (re.compile(r"(key=)([a-zA-Z0-9_\-]{16,})", re.IGNORECASE), r"\1[REDACTED]"),
    (re.compile(r"(x-goog-api-key\s*[:=]\s*)(['\"]?[a-zA-Z0-9_\-]{8,}['\"]?)", re.IGNORECASE), r"\1[REDACTED]"),
]


def _scrub_value(val: Any) -> Any:
    """Recursively scrub sensitive credential patterns from strings, dicts, lists, and tuples."""
    if isinstance(val, str):
        result = val
        for item in SENSITIVE_PATTERNS:
            if isinstance(item, tuple):
                pattern, repl = item
            else:
                pattern = item
                repl = r"\1[REDACTED]\3" if pattern.groups >= 3 else r"\1[REDACTED]"
            result = pattern.sub(repl, result)
        return result
    elif isinstance(val, dict):
        return {_scrub_value(k): _scrub_value(v) for k, v in val.items()}
    elif isinstance(val, list):
        return [_scrub_value(v) for v in val]
    elif isinstance(val, tuple):
        return tuple(_scrub_value(v) for v in val)
    return val


class SensitiveDataScrubber(logging.Filter):
    """Intercepts and scrubs credentials and keys before writing to log streams."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = _scrub_value(record.msg)
        elif record.msg:
            record.msg = _scrub_value(record.msg)

        if record.args:
            record.args = _scrub_value(record.args)

        if getattr(record, "exc_text", None):
            record.exc_text = _scrub_value(record.exc_text)
        elif getattr(record, "exc_info", None) and isinstance(record.exc_info, tuple) and len(record.exc_info) >= 2:
            raw_tb = "".join(traceback.format_exception(*record.exc_info))
            record.exc_text = _scrub_value(raw_tb)

        return True


class JSONLogFormatter(logging.Formatter):
    """Formats log records as structured, machine-parsable JSON lines with tracing metadata."""

    def format(self, record: logging.LogRecord) -> str:
        # 1. Scrub sensitive tokens from the formatted message
        message = _scrub_value(record.getMessage())
        log_payload: dict[str, Any] = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": message,
            "correlation_id": getattr(record, "correlation_id", None) or CORRELATION_ID_CTX.get() or "",
            "trace_id": getattr(record, "trace_id", None) or TRACE_ID_CTX.get() or "",
            "span_id": getattr(record, "span_id", None) or SPAN_ID_CTX.get() or "",
        }

        # Extra operational observability fields if present
        for field in ("path", "method", "status_code", "duration_ms", "client_ip", "event"):
            val = getattr(record, field, None)
            if val is not None:
                log_payload[field] = val

        if record.exc_info and os.getenv("ENVIRONMENT") != "production":
            log_payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_payload, ensure_ascii=False)


class TracingAndStructuredLoggingMiddleware:
    """
    Pure ASGI middleware providing W3C distributed tracing, correlation IDs,
    and structured access logging with Prometheus metrics integration.
    """

    def __init__(self, app: Any):
        self.app = app
        self.logger = logging.getLogger("Tellura.access")

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers_raw = dict(scope.get("headers", []))

        # 1. Extract or generate X-Correlation-ID
        raw_corr_id = (
            headers_raw.get(b"x-correlation-id")
            or headers_raw.get(b"x-request-id")
        )
        if raw_corr_id:
            try:
                decoded_corr = raw_corr_id.decode("latin1").strip()
                if SAFE_CORRELATION_ID_REGEX.match(decoded_corr):
                    correlation_id = decoded_corr
                else:
                    correlation_id = f"corr_{secrets.token_hex(8)}"
            except Exception:
                correlation_id = f"corr_{secrets.token_hex(8)}"
        else:
            correlation_id = f"corr_{secrets.token_hex(8)}"

        # 2. Extract or generate W3C traceparent (version-trace_id-parent_id-flags)
        raw_traceparent = headers_raw.get(b"traceparent")
        trace_id: str | None = None
        if raw_traceparent:
            with contextlib.suppress(Exception):
                decoded_tp = raw_traceparent.decode("latin1").strip()
                match = TRACEPARENT_REGEX.match(decoded_tp)
                if match and match.group(1) == "00":
                    trace_id = match.group(2)

        if not trace_id or trace_id == "0" * 32:
            trace_id = secrets.token_hex(16)  # 32 hex chars

        span_id = secrets.token_hex(8)  # 16 hex chars
        outgoing_traceparent = f"00-{trace_id}-{span_id}-01"

        # 3. Bind context variables
        token_corr = CORRELATION_ID_CTX.set(correlation_id)
        token_trace = TRACE_ID_CTX.set(trace_id)
        token_span = SPAN_ID_CTX.set(span_id)

        # Attach to scope state for downstream route handlers
        if "state" not in scope:
            scope["state"] = {}
        scope["state"]["correlation_id"] = correlation_id
        scope["state"]["trace_id"] = trace_id
        scope["state"]["span_id"] = span_id

        # 4. Telemetry tracking
        start_time = time.perf_counter()
        status_code = 500  # Default in case of unhandled crash
        client_host = scope.get("client", [""])[0] if scope.get("client") else ""
        path = scope.get("path", "")
        method = scope.get("method", "")

        from app.core.telemetry import ACTIVE_REQUESTS, record_http_request
        ACTIVE_REQUESTS.inc()

        async def send_wrapper(message: Message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message.get("status", 200)
                headers = list(message.get("headers", []))
                existing_keys = {h[0].lower() for h in headers}

                if b"x-correlation-id" not in existing_keys:
                    headers.append((b"x-correlation-id", correlation_id.encode("latin1")))
                if b"traceparent" not in existing_keys:
                    headers.append((b"traceparent", outgoing_traceparent.encode("latin1")))

                message["headers"] = headers

            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            ACTIVE_REQUESTS.dec()
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            duration_seconds = duration_ms / 1000.0

            # Record Prometheus metrics
            record_http_request(method, path, status_code, duration_seconds)

            # Produce structured JSON access log
            extra_dict = {
                "correlation_id": correlation_id,
                "trace_id": trace_id,
                "span_id": span_id,
                "path": path,
                "method": method,
                "status_code": status_code,
                "duration_ms": duration_ms,
                "client_ip": client_host,
                "event": "http_request",
            }

            log_level = logging.INFO
            if status_code >= 500:
                log_level = logging.ERROR
            elif status_code >= 400:
                log_level = logging.WARNING

            self.logger.log(
                log_level,
                "HTTP %s %s -> %s (%.2f ms)",
                method,
                path,
                status_code,
                duration_ms,
                extra=extra_dict,
            )

            CORRELATION_ID_CTX.reset(token_corr)
            TRACE_ID_CTX.reset(token_trace)
            SPAN_ID_CTX.reset(token_span)


def install_security_logging(enable_json: bool | None = None) -> None:
    """
    Attaches SensitiveDataScrubber filter to root and application logger handlers.
    Applies JSONLogFormatter when enable_json is True or in production.
    """
    scrubber = SensitiveDataScrubber()
    root_logger = logging.getLogger()

    # Ensure at least one StreamHandler exists on the root logger
    if not root_logger.handlers:
        console_handler = logging.StreamHandler()
        root_logger.addHandler(console_handler)

    use_json = enable_json if enable_json is not None else (
        os.getenv("STRUCTURED_LOGGING", "").lower() in ("true", "1")
        or os.getenv("ENVIRONMENT") == "production"
    )

    json_formatter: JSONLogFormatter | None = None
    if use_json:
        json_formatter = JSONLogFormatter()
        for handler in root_logger.handlers:
            handler.setFormatter(json_formatter)

    for handler in root_logger.handlers:
        handler.addFilter(scrubber)

    for name in ["uvicorn", "uvicorn.access", "uvicorn.error", "Tellura", "fastapi"]:
        lg = logging.getLogger(name)
        lg.addFilter(scrubber)
        if use_json and json_formatter is not None:
            for h in lg.handlers:
                h.setFormatter(json_formatter)
        for h in lg.handlers:
            h.addFilter(scrubber)
