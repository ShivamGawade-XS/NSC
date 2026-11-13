"""
Tellura — Authentication & Authorization Layer (Two-Tier Model)
Provides constant-time static API key verification, quota tier classification,
internal-only listener protection, and daily LLM spend/budget caps.
"""
import hashlib
import hmac
import ipaddress
import logging
import os
import threading
import time
from enum import StrEnum
from typing import Any

from fastapi import HTTPException, Request
from fastapi.security import APIKeyHeader

logger = logging.getLogger("Tellura.auth")

api_key_header_scheme = APIKeyHeader(name="X-API-Key", auto_error=False)


class AuthTier(StrEnum):
    ANONYMOUS = "anonymous"
    KEYED = "keyed"


_KEY_HASHES_LOCK = threading.Lock()
_VALID_KEY_HASHES: set[bytes] = set()


def _hash_key(key: str) -> bytes:
    """Compute constant-time comparison hash for an API key."""
    return hashlib.sha256(key.strip().encode("utf-8")).digest()


def reload_api_keys() -> None:
    """Load valid API keys from TELLURA_API_KEYS environment variable."""
    global _VALID_KEY_HASHES
    raw_keys = os.getenv("TELLURA_API_KEYS", "")
    new_hashes: set[bytes] = set()
    for token in raw_keys.split(","):
        cleaned = token.strip()
        if cleaned:
            new_hashes.add(_hash_key(cleaned))
    with _KEY_HASHES_LOCK:
        _VALID_KEY_HASHES = new_hashes
    logger.info("Loaded %d active API key hash(es) into memory.", len(new_hashes))


# Initialize on module import
reload_api_keys()


def extract_api_key(request: Request) -> str | None:
    """
    Extract API key from X-API-Key or Authorization: Bearer <key> header.
    Never logs or exposes the key material.
    """
    key = request.headers.get("x-api-key")
    if key and key.strip():
        return key.strip()

    auth_header = request.headers.get("authorization")
    if auth_header:
        parts = auth_header.strip().split(maxsplit=1)
        if len(parts) == 2 and parts[0].lower() == "bearer" and parts[1].strip():
            return parts[1].strip()

    return None


def verify_api_key(raw_key: str) -> bool:
    """Verify an API key in constant time against stored hashes."""
    if not raw_key:
        return False
    candidate_hash = _hash_key(raw_key)
    with _KEY_HASHES_LOCK:
        for valid_hash in _VALID_KEY_HASHES:
            if hmac.compare_digest(candidate_hash, valid_hash):
                return True
    return False


def is_private_or_loopback_ip(ip_str: str) -> bool:
    """Check if an IP string corresponds to loopback or RFC1918/RFC4193 private ranges."""
    try:
        ip = ipaddress.ip_address(ip_str.strip())
        return ip.is_loopback or ip.is_private
    except ValueError:
        return False


def is_internal_listener(request: Request) -> bool:
    """
    Check if request arrives on the internal loopback listener or private network
    without passing through an untrusted external proxy chain.
    """
    if request.headers.get("x-external-client", "").lower() == "true":
        return False
    xff = request.headers.get("x-forwarded-for")
    if xff:
        # Check all IPs in forwarded-for chain: all must be loopback or private
        for raw_ip in xff.split(","):
            cleaned = raw_ip.strip()
            if cleaned and not is_private_or_loopback_ip(cleaned):
                return False
    client_host = request.client.host if request.client else None
    if client_host in ("127.0.0.1", "::1", "localhost", "testclient"):
        return True
    if client_host and is_private_or_loopback_ip(client_host):
        return True
    return False


def get_auth_tier(request: Request) -> AuthTier:
    """
    Determine whether request is Anonymous or Keyed.
    If an API key is provided but invalid, immediately raises 401 Unauthorized.
    If no key is provided, returns AuthTier.ANONYMOUS.
    """
    key = extract_api_key(request)
    if key is None:
        return AuthTier.ANONYMOUS

    if verify_api_key(key):
        return AuthTier.KEYED

    logger.warning("Invalid API key attempt from client IP: %s", getattr(request.state, "client_ip", "unknown"))
    raise HTTPException(
        status_code=401,
        detail="Unauthorized: Invalid API key provided.",
        headers={"WWW-Authenticate": "Bearer"}
    )


def require_api_key(request: Request) -> AuthTier:
    """Dependency for endpoints restricted exclusively to the Keyed tier."""
    tier = get_auth_tier(request)
    if tier != AuthTier.KEYED:
        raise HTTPException(
            status_code=401,
            detail="Authentication required: Provide a valid API key via 'X-API-Key' or 'Authorization: Bearer' header.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    return tier


def require_metrics_access(request: Request) -> AuthTier:
    """
    Restrict /metrics and /auth/status.
    If METRICS_TOKEN is configured:
        Require exact matching token as Bearer token or X-API-Key header.
    If METRICS_TOKEN is not configured:
        Allow loopback and private-network clients, or callers with a valid API key.
    External unauthenticated requests receive 401 Unauthorized.
    """
    metrics_token = os.getenv("METRICS_TOKEN")
    key = extract_api_key(request)

    if metrics_token:
        if key and hmac.compare_digest(key, metrics_token):
            return AuthTier.KEYED
        raise HTTPException(
            status_code=401,
            detail="Unauthorized: /metrics and /auth/status require a valid METRICS_TOKEN bearer token.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if key:
        if verify_api_key(key):
            return AuthTier.KEYED
        raise HTTPException(
            status_code=401,
            detail="Unauthorized: Invalid API key provided.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if is_internal_listener(request):
        return AuthTier.KEYED

    raise HTTPException(
        status_code=401,
        detail="Unauthorized: /metrics and /auth/status require a valid API key or internal listener.",
        headers={"WWW-Authenticate": "Bearer"}
    )


# -------------------------------------------------------------------------
# Global Daily LLM Spend / Token Quota Tracker
# -------------------------------------------------------------------------

class DailyLLMBudgetTracker:
    """Tracks daily external LLM calls and degrades to deterministic template when limit hit."""

    def __init__(self):
        self._lock = threading.Lock()
        self._current_day: int = self._today()
        self._daily_count: int = 0

    @staticmethod
    def _today() -> int:
        return int(time.time() // 86400)

    def get_limit(self) -> int:
        return int(os.getenv("DAILY_LLM_CALL_LIMIT", "200"))

    def check_and_increment(self) -> bool:
        """
        Check if under daily quota. If so, increments and returns True.
        If daily limit reached, returns False.
        """
        today = self._today()
        limit = self.get_limit()
        with self._lock:
            if today != self._current_day:
                self._current_day = today
                self._daily_count = 0

            if self._daily_count >= limit:
                logger.warning(
                    "Global daily LLM call cap (%d calls) reached. Degrading to deterministic template.",
                    limit
                )
                return False

            self._daily_count += 1
            return True

    def get_status(self) -> dict[str, Any]:
        today = self._today()
        with self._lock:
            if today != self._current_day:
                self._current_day = today
                self._daily_count = 0
            count = self._daily_count
            limit = self.get_limit()
        return {
            "daily_calls_used": count,
            "daily_call_limit": limit,
            "remaining_calls": max(0, limit - count),
            "cap_exhausted": count >= limit
        }


llm_budget_tracker = DailyLLMBudgetTracker()
