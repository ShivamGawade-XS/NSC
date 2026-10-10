"""
Unit tests for EarthSift SQLite persistent cache and B-Tree indexing.
"""

import time
import pytest
from app.core.db_cache import (
    save_to_db_cache,
    load_from_db_cache,
    find_cached_analysis_id,
    get_cache_db_stats
)
from app.schemas.analysis import AnalysisRequest


def test_sqlite_db_cache_lifecycle(tmp_path):
    test_id = f"ana_test_db_{int(time.time() * 1000)}"
    req = AnalysisRequest(
        dataset_id="nasa_power",
        variable_id="T2M",
        start_year=2005,
        end_year=2020,
        bbox=[-100.0, 31.0, -95.0, 36.0],
        alpha=0.05,
        apply_fdr=True
    )
    payload = {
        "req": req,
        "sample_data": [1.0, 2.0, 3.0],
        "summary": {"test_metric": 42.0}
    }

    # Save to SQLite database cache
    save_to_db_cache(test_id, payload)

    # Load back by ID
    loaded = load_from_db_cache(test_id)
    assert loaded is not None
    assert loaded["summary"]["test_metric"] == 42.0
    assert loaded["req"].variable_id == "T2M"

    # Verify B-Tree index discovery
    found_id = find_cached_analysis_id(
        dataset_id="nasa_power",
        variable_id="T2M",
        start_year=2005,
        end_year=2020,
        bbox=[-100.0, 31.0, -95.0, 36.0],
        alpha=0.05
    )
    assert found_id == test_id

    # Verify stats reporting
    stats = get_cache_db_stats()
    assert "indexed_records" in stats
    assert stats["indexed_records"] >= 1
    assert stats["wal_mode_active"] is True
