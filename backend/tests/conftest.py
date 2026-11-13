import sys
from pathlib import Path

import pytest

# Ensure backend root is always on sys.path
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from app.core.db_cache import close_all_connections, close_db_connection  # noqa: E402


@pytest.fixture(autouse=True)
def _clean_sqlite_connections():
    """Ensure thread-local SQLite connections are cleanly closed after each test."""
    yield
    close_db_connection()


@pytest.fixture(scope="session", autouse=True)
def _clean_all_sqlite_connections_session():
    """Ensure all open connections across all threads are closed after the session."""
    yield
    close_all_connections()

