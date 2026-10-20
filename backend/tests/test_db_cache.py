"""
Unit tests for EarthSift SQLite persistent cache and B-Tree indexing.
"""

import time

from app.core.db_cache import (
    find_cached_analysis_id,
    get_cache_db_stats,
    load_from_db_cache,
    save_to_db_cache,
)
from app.schemas.analysis import AnalysisRequest


def test_sqlite_db_cache_lifecycle(tmp_path):
    unique_ts = int(time.time() * 1000)
    test_id = f"ana_test_db_{unique_ts}"
    test_var = f"TEST_VAR_{unique_ts}"
    req = AnalysisRequest(
        dataset_id="nasa_power",
        variable_id=test_var,
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
    assert loaded["req"].variable_id == test_var

    # Verify B-Tree index discovery
    found_id = find_cached_analysis_id(
        dataset_id="nasa_power",
        variable_id=test_var,
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


def test_json_encoder_ndarray_pydantic_fidelity():
    """Verify safe JSON encoder/decoder round-trip for Pydantic models, ndarrays, and scalars."""
    import numpy as np
    from app.schemas.analysis import AnalysisRequest, AnalysisSummary

    test_id = f"ana_fidelity_{int(time.time() * 1000)}"
    req = AnalysisRequest(
        dataset_id="merra2_reanalysis",
        variable_id="T2M",
        start_year=2000,
        end_year=2023,
        bbox=[-10.0, 30.0, 10.0, 45.0],
        alpha=0.01,
        prefer_live=True,
        use_fdr=True
    )
    summary = AnalysisSummary(
        total_cells=100,
        significant_cells_raw=45,
        significant_cells_fdr=30,
        mean_slope=0.042,
        max_slope=0.15,
        min_slope=-0.08,
        spatial_autocorrelation={"moran_i": 0.35, "is_clustered": True}
    )
    arr_2d = np.array([[1.0, 2.5, np.nan], [4.0, -5.5, 6.0]], dtype=np.float64)
    arr_3d = np.zeros((3, 4, 5), dtype=np.int32)
    arr_3d[1, 2, 3] = 99

    payload = {
        "req": req,
        "summary": summary,
        "arr_2d": arr_2d,
        "arr_3d": arr_3d,
        "scalar_f64": np.float64(3.14159),
        "scalar_i64": np.int64(42),
        "scalar_bool": np.bool_(True)
    }

    save_to_db_cache(test_id, payload)
    loaded = load_from_db_cache(test_id)
    assert loaded is not None

    # Verify Pydantic AnalysisRequest reconstruction
    assert isinstance(loaded["req"], AnalysisRequest)
    assert loaded["req"].variable_id == "T2M"
    assert loaded["req"].alpha == 0.01

    # Verify Pydantic AnalysisSummary reconstruction
    assert isinstance(loaded["summary"], AnalysisSummary)
    assert loaded["summary"].total_cells == 100
    assert loaded["summary"].mean_slope == 0.042

    # Verify NumPy ndarray reconstruction
    assert isinstance(loaded["arr_2d"], np.ndarray)
    assert loaded["arr_2d"].shape == (2, 3)
    assert loaded["arr_2d"].dtype == np.float64
    assert np.isnan(loaded["arr_2d"][0, 2])
    assert loaded["arr_2d"][1, 1] == -5.5

    assert isinstance(loaded["arr_3d"], np.ndarray)
    assert loaded["arr_3d"].shape == (3, 4, 5)
    assert loaded["arr_3d"][1, 2, 3] == 99

    # Verify scalars
    assert loaded["scalar_f64"] == 3.14159
    assert loaded["scalar_i64"] == 42
    assert loaded["scalar_bool"] is True
