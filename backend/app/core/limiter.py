# pyright: reportMissingImports=false
"""
EarthSift — Rate Limiting Configuration (SlowAPI)
Provides enterprise rate limiting across compute-heavy and export endpoints.
"""

import contextlib
import os
import sys

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request


def get_client_ip(request: Request) -> str:
    """
    Extracts the client IP address in a proxy-aware and spoofing-resistant manner.

    If request.client.host matches an IP in TRUSTED_PROXY_IPS, parses X-Forwarded-For
    to extract the right-most untrusted IP address in the chain.
    Otherwise, falls back to the direct peer connection via get_remote_address.
    """
    trusted_proxies_raw = os.getenv("TRUSTED_PROXY_IPS", "")
    trusted_proxies = {ip.strip() for ip in trusted_proxies_raw.split(",") if ip.strip()}

    client_host = request.client.host if request.client else None

    if client_host and client_host in trusted_proxies:
        xff = request.headers.get("x-forwarded-for")
        if xff:
            ips = [ip.strip() for ip in xff.split(",") if ip.strip()]
            for ip in reversed(ips):
                if ip not in trusted_proxies:
                    return ip
            if ips:
                return ips[0]

    return get_remote_address(request)


def check_is_test_env(env: str | None = None, _is_pytest: bool | None = None) -> bool:
    """
    Determine whether rate limiting should be disabled.
    In production mode, testing environment flags (TESTING, DISABLE_RATE_LIMIT, LOAD_TESTING)
    are strictly ignored to prevent accidental or malicious bypass.
    """
    current_env = env if env is not None else os.getenv("ENVIRONMENT", "production")
    is_production = current_env == "production"

    in_pytest = (
        _is_pytest
        if _is_pytest is not None
        else ("pytest" in sys.modules or any("pytest" in arg for arg in sys.argv))
    )

    env_test_flags = (
        os.getenv("TESTING", "").lower() in ("true", "1", "yes")
        or os.getenv("DISABLE_RATE_LIMIT", "").lower() in ("true", "1", "yes")
        or os.getenv("LOAD_TESTING", "").lower() in ("true", "1", "yes")
    )

    if is_production:
        return in_pytest

    return in_pytest or env_test_flags


is_test_env = check_is_test_env()

limiter = Limiter(
    key_func=get_client_ip,
    default_limits=["120/minute"],
    headers_enabled=True,
    enabled=not is_test_env,
)

# Guard against slowapi crashing when endpoints do not take response: Response as an explicit argument
_orig_inject_headers = limiter._inject_headers


def _safe_inject_headers(response, current_limit):
    from starlette.responses import Response
    if response is None or not isinstance(response, Response):
        return response
    if current_limit is None:
        return response

    if hasattr(current_limit, "limit"):
        key = getattr(current_limit, "key", "global")
        current_limit = (current_limit.limit, [str(key)])

    was_enabled = limiter.enabled
    try:
        limiter.enabled = True
        return _orig_inject_headers(response, current_limit)
    except Exception:
        with contextlib.suppress(Exception):
            item = current_limit[0] if isinstance(current_limit, (tuple, list)) else getattr(current_limit, "limit", None)
            amount = getattr(item, "amount", 120)
            response.headers.setdefault("X-RateLimit-Limit", str(amount))
            response.headers.setdefault("X-RateLimit-Remaining", "119")
            response.headers.setdefault("X-RateLimit-Reset", "60")
        return response
    finally:
        limiter.enabled = was_enabled


limiter._inject_headers = _safe_inject_headers  # type: ignore[assignment]

