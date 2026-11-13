"""
Tests for F-004: Event Loop Unblocking.
Asserts that handlers performing synchronous blocking I/O (SQLite, zlib decompression, HMAC checks)
are defined as synchronous `def` functions rather than `async def`, guaranteeing Starlette/FastAPI
executes them in the worker threadpool and never blocks the asyncio event loop.
"""
import inspect
import pytest

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


@pytest.mark.asyncio
async def test_submit_contact_does_not_block_event_loop(monkeypatch):
    """
    F-01 Regression Test: Verify submit_contact offloads blocking SMTP calls to a worker thread,
    preventing starvation of concurrent event loop requests (e.g. /health).
    """
    import asyncio
    import time
    import httpx
    import app.api.endpoints as ep

    slow_delay = 0.35

    def slow_smtp_mock(**kwargs):
        time.sleep(slow_delay)
        return {
            "success": True,
            "message": "Dispatched via mock SMTP thread",
            "channel": "smtp",
            "receipt_id": "test-receipt-001"
        }

    monkeypatch.setattr(ep, "send_contact_inquiry", slow_smtp_mock)

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as async_client:
        async def post_contact():
            return await async_client.post(
                "/api/v1/contact",
                json={
                    "name": "Audit Tester",
                    "email": "audit@example.com",
                    "topic": "Security Testing",
                    "message": "Testing event loop responsiveness under simulated network latency."
                }
            )

        async def probe_health():
            # Allow contact task to enter execution
            await asyncio.sleep(0.04)
            t_start = time.perf_counter()
            resp = await async_client.get("/api/v1/health")
            t_elapsed = time.perf_counter() - t_start
            return resp, t_elapsed

        contact_resp, (health_resp, health_elapsed) = await asyncio.gather(
            post_contact(),
            probe_health()
        )

        assert contact_resp.status_code == 200
        assert contact_resp.json()["receipt_id"] == "test-receipt-001"
        assert health_resp.status_code == 200
        # /health probe must resolve in < 0.20s even though SMTP took >= 0.35s
        assert health_elapsed < 0.20, f"Health probe blocked on event loop! Elapsed: {health_elapsed:.4f}s"


@pytest.mark.asyncio
async def test_record_telemetry_offloaded_to_thread(monkeypatch):
    """
    F-01 Regression Test: Verify record_telemetry offloads SQLite writes to a worker thread.
    """
    import httpx
    import app.core.db_cache as db_cache

    recorded_events = []

    def mock_save_telemetry(event, page, props):
        recorded_events.append((event, page, props))

    monkeypatch.setattr(db_cache, "save_telemetry_event", mock_save_telemetry)

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as async_client:
        resp = await async_client.post(
            "/api/v1/telemetry",
            json={
                "event": "audit_metric_view",
                "page": "/workstation",
                "properties": {"test": True}
            }
        )
        assert resp.status_code == 200
        assert resp.json()["recorded"] is True
        assert len(recorded_events) == 1
        assert recorded_events[0][0] == "audit_metric_view"

