"""
Test F-03: Deterministic SQLite connection lifecycle and ResourceWarning elimination.
"""
import concurrent.futures
import warnings

from app.core.db_cache import (
    _OPEN_CONNECTIONS,
    close_all_connections,
    close_db_connection,
    get_db_connection,
)


def test_thread_pool_connections_cleanly_closed_without_resource_warnings():
    """Verify worker threads accessing DB in threadpool do not produce ResourceWarnings."""
    with warnings.catch_warnings(record=True) as recorded_warnings:
        warnings.simplefilter("always", ResourceWarning)

        def worker_task(i: int):
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("SELECT 1;")
            val = cur.fetchone()[0]
            return val + i

        # Run 10 parallel threadpool tasks across distinct threads
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(worker_task, i) for i in range(10)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]

        assert len(results) == 10
        assert all(r >= 1 for r in results)

    # Check that no ResourceWarning about unclosed database was triggered
    unclosed_db_warnings = [
        w for w in recorded_warnings
        if issubclass(w.category, ResourceWarning) and "unclosed database" in str(w.message).lower()
    ]
    assert len(unclosed_db_warnings) == 0, f"Detected unclosed database warnings: {unclosed_db_warnings}"


def test_close_all_connections():
    """Verify close_all_connections shuts down every tracked connection."""
    conn = get_db_connection()
    assert conn in _OPEN_CONNECTIONS

    close_all_connections()
    assert len(_OPEN_CONNECTIONS) == 0

    # Getting connection again creates a fresh open connection
    fresh_conn = get_db_connection()
    assert fresh_conn in _OPEN_CONNECTIONS
    close_db_connection()
    assert fresh_conn not in _OPEN_CONNECTIONS
