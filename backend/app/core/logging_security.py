"""
EarthSift — Security Logging Sanitizer
Applies regex scrubbing across all application logs to eliminate accidental
leakage of API keys, bearer tokens, passwords, and sensitive credentials.
"""

import logging
import re
import traceback
from typing import Any

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


def install_security_logging() -> None:
    """Attaches SensitiveDataScrubber filter to root and third-party logger handlers."""
    scrubber = SensitiveDataScrubber()
    root_logger = logging.getLogger()
    root_logger.addFilter(scrubber)
    for handler in root_logger.handlers:
        handler.addFilter(scrubber)

    for name in ["uvicorn", "uvicorn.access", "uvicorn.error", "earthsift", "fastapi"]:
        lg = logging.getLogger(name)
        lg.addFilter(scrubber)
        for h in lg.handlers:
            h.addFilter(scrubber)
