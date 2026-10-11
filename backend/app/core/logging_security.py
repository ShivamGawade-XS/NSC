"""
EarthSift — Security Logging Sanitizer
Applies regex scrubbing across all application logs to eliminate accidental
leakage of API keys, bearer tokens, passwords, and sensitive credentials.
"""

import logging
import re

SENSITIVE_PATTERNS = [
    re.compile(r"(api[-_]?key\s*[:=]\s*)(['\"]?[a-zA-Z0-9_\-]{8,}['\"]?)", re.IGNORECASE),
    re.compile(r"(password\s*[:=]\s*)(['\"]?[^\s,'\"]+['\"]?)", re.IGNORECASE),
    re.compile(r"(token\s*[:=]\s*)(['\"]?[a-zA-Z0-9_\-\.]{8,}['\"]?)", re.IGNORECASE),
    re.compile(r"(secret\s*[:=]\s*)(['\"]?[a-zA-Z0-9_\-]{8,}['\"]?)", re.IGNORECASE),
    re.compile(r"(Bearer\s+)([a-zA-Z0-9_\-\.]{10,})", re.IGNORECASE),
    re.compile(r"(key=[a-zA-Z0-9_\-]{16,})", re.IGNORECASE),
    re.compile(r"(x-goog-api-key\s*[:=]\s*)(['\"]?[a-zA-Z0-9_\-]{8,}['\"]?)", re.IGNORECASE),
]


class SensitiveDataScrubber(logging.Filter):
    """Intercepts and scrubs credentials and keys before writing to log streams."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            for pattern in SENSITIVE_PATTERNS:
                record.msg = pattern.sub(r"\1[REDACTED]", record.msg)
        if record.args:
            if isinstance(record.args, dict):
                cleaned = {}
                for k, v in record.args.items():
                    val_str = str(v)
                    for pattern in SENSITIVE_PATTERNS:
                        val_str = pattern.sub(r"\1[REDACTED]", val_str)
                    cleaned[k] = val_str
                record.args = cleaned
            elif isinstance(record.args, (list, tuple)):
                cleaned = []
                for v in record.args:
                    val_str = str(v)
                    for pattern in SENSITIVE_PATTERNS:
                        val_str = pattern.sub(r"\1[REDACTED]", val_str)
                    cleaned.append(val_str)
                record.args = tuple(cleaned)
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
