"""
Tests for F-002: Redis Limiter Backend with Multi-Worker Validation.
Verifies rate limiter storage URI configuration, multi-worker safety checks,
and enforcement against quota multiplication in multi-process deployments.
"""
import pytest
from limits.storage import storage_from_string
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.limiter import (
    get_limiter_storage_uri,
    validate_multi_worker_configuration,
)


def test_limiter_storage_uri_defaults_to_memory(monkeypatch):
    """When REDIS_URL is not set, limiter storage defaults cleanly to memory://."""
    monkeypatch.delenv("REDIS_URL", raising=False)
    uri = get_limiter_storage_uri()
    assert uri == "memory://"
    storage = storage_from_string(uri)
    assert "MemoryStorage" in type(storage).__name__


def test_limiter_storage_uri_uses_redis(monkeypatch):
    """When REDIS_URL is provided, limiter storage URI uses the Redis endpoint."""
    test_redis = "redis://127.0.0.1:6379/0"
    monkeypatch.setenv("REDIS_URL", test_redis)
    uri = get_limiter_storage_uri()
    assert uri == test_redis


def test_multi_worker_without_redis_triggers_warning(monkeypatch):
    """When workers > 1 without REDIS_URL, validation returns warning status."""
    monkeypatch.delenv("REDIS_URL", raising=False)
    monkeypatch.setenv("WEB_CONCURRENCY", "4")
    monkeypatch.delenv("ENFORCE_DISTRIBUTED_LIMITER", raising=False)

    status = validate_multi_worker_configuration()
    assert status["is_multi_worker"] is True
    assert status["workers"] == 4
    assert status["distributed_shared"] is False
    assert status["storage_backend"] == "memory"


def test_multi_worker_strict_enforcement_raises(monkeypatch):
    """When ENFORCE_DISTRIBUTED_LIMITER is enabled, multi-worker without Redis fails closed."""
    monkeypatch.delenv("REDIS_URL", raising=False)
    monkeypatch.setenv("WEB_CONCURRENCY", "2")
    monkeypatch.setenv("ENFORCE_DISTRIBUTED_LIMITER", "true")

    with pytest.raises(RuntimeError) as exc_info:
        validate_multi_worker_configuration()
    assert "MULTI-WORKER WARNING" in str(exc_info.value)
    assert "Configure REDIS_URL" in str(exc_info.value) or "provide valid REDIS_URL" in str(exc_info.value)


def test_multi_worker_with_redis_passes_validation(monkeypatch):
    """When multi-worker has valid REDIS_URL, validation passes cleanly."""
    monkeypatch.setenv("WEB_CONCURRENCY", "4")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/1")

    status = validate_multi_worker_configuration()
    assert status["is_multi_worker"] is True
    assert status["distributed_shared"] is True
    assert status["storage_backend"] == "redis"
