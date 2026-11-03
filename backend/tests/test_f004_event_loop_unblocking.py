"""
Tests for F-004: Event Loop Unblocking.
Asserts that handlers performing synchronous blocking I/O (SQLite, zlib decompression, HMAC checks)
are defined as synchronous `def` functions rather than `async def`, guaranteeing Starlette/FastAPI
executes them in the worker threadpool and never blocks the asyncio event loop.
"""
import inspect
from fastapi.testclient import TestClient

from app.api.endpoints import get_analysis, health_check
from app.main import app

client = TestClient(app)


def test_get_analysis_is_not_coroutine():
    """Verify get_analysis is a sync def function offloaded to worker threadpool."""
    assert not inspect.iscoroutinefunction(get_analysis), (
        "get_analysis must NOT be an async coroutine function, as sync SQLite and zlib I/O "
        "would block the event loop. It must be defined as 'def get_analysis'."
    )


def test_health_check_remains_async():
    """Verify purely memory-bound probes remain async coroutines."""
    assert inspect.iscoroutinefunction(health_check), (
        "health_check is non-blocking memory probe and should remain async def."
    )


def test_get_analysis_retrieval_integrity(client_with_data=None):
    """Verify get_analysis functions correctly via TestClient when executed in threadpool."""
    res_404 = client.get("/api/v1/analysis/nonexistent-id-000")
    assert res_404.status_code == 404
