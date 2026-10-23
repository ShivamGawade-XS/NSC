"""
Unit tests for EarthSift SQLite persistent cache and B-Tree indexing.
"""

import time

from app.core.db_cache import (
    find_cached_analysis_id,
    get_cache_db_stats,
    load_cell_from_db_cache,
    load_from_db_cache,
    save_cell_to_db_cache,
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
        use_fdr=True
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


def test_fdr_controlled_distinction_no_collision():
    """Verify that use_fdr=True and use_fdr=False do not collide in find_cached_analysis_id."""
    unique_ts = int(time.time() * 1000)
    var_name = f"FDR_TEST_{unique_ts}"
    bbox = [-105.0, 32.0, -98.0, 38.0]

    # Save analysis with use_fdr=True
    req_fdr_true = AnalysisRequest(
        dataset_id="merra2_reanalysis",
        variable_id=var_name,
        start_year=2000,
        end_year=2020,
        bbox=bbox,
        alpha=0.05,
        use_fdr=True
    )
    id_true = f"ana_{var_name}_fdr_true"
    save_to_db_cache(id_true, {"req": req_fdr_true, "data": "with_fdr"})

    # Save analysis with use_fdr=False
    req_fdr_false = AnalysisRequest(
        dataset_id="merra2_reanalysis",
        variable_id=var_name,
        start_year=2000,
        end_year=2020,
        bbox=bbox,
        alpha=0.05,
        use_fdr=False
    )
    id_false = f"ana_{var_name}_fdr_false"
    save_to_db_cache(id_false, {"req": req_fdr_false, "data": "without_fdr"})

    # Query with use_fdr=True
    found_true = find_cached_analysis_id(
        dataset_id="merra2_reanalysis",
        variable_id=var_name,
        start_year=2000,
        end_year=2020,
        bbox=bbox,
        alpha=0.05,
        use_fdr=True
    )
    assert found_true == id_true

    # Query with use_fdr=False
    found_false = find_cached_analysis_id(
        dataset_id="merra2_reanalysis",
        variable_id=var_name,
        start_year=2000,
        end_year=2020,
        bbox=bbox,
        alpha=0.05,
        use_fdr=False
    )
    assert found_false == id_false
    assert found_true != found_false


def test_spatial_cell_cache_read_write_lifecycle():
    """Verify save_cell_to_db_cache and load_cell_from_db_cache round-trip with HMAC signing."""
    analysis_id = f"ana_cell_test_{int(time.time() * 1000)}"
    lat = 34.0522
    lon = -118.2437

    cell_payload = {
        "lat": lat,
        "lon": lon,
        "slope": 0.0314,
        "p_value": 0.002,
        "q_value": 0.008,
        "significant": True,
        "changepoint_year": 2012,
        "observations": [14.2, 14.8, 15.1, 15.5],
        "years": [2010, 2011, 2012, 2013]
    }

    save_cell_to_db_cache(analysis_id, lat, lon, cell_payload)

    loaded = load_cell_from_db_cache(analysis_id, lat, lon)
    assert loaded is not None
    assert loaded["lat"] == lat
    assert loaded["lon"] == lon
    assert loaded["slope"] == 0.0314
    assert loaded["significant"] is True
    assert loaded["changepoint_year"] == 2012
    assert loaded["years"] == [2010, 2011, 2012, 2013]

    # Test missing cell returns None
    assert load_cell_from_db_cache(analysis_id, 0.0, 0.0) is None


def test_sqlite_concurrent_read_write_stress():
    """
    Verify high-concurrency stress testing across SQLite WAL database cache.
    Executes 80 simultaneous save_to_db_cache, load_from_db_cache, and
    find_cached_analysis_id operations across 16 worker threads.
    Asserts zero sqlite3.OperationalError exceptions, 100% HMAC verification accuracy,
    and zero cache collisions between use_fdr=True and use_fdr=False.
    """
    import concurrent.futures
    import sqlite3

    unique_batch = int(time.time() * 1000)
    total_operations = 80
    worker_threads = 16

    def stress_worker(i: int) -> dict:
        use_fdr = (i % 2 == 0)
        group_idx = i // 2
        var_id = f"STRESS_VAR_{unique_batch}_{group_idx}"
        analysis_id = f"ana_stress_{unique_batch}_{i}_{use_fdr}"
        bbox = [-100.0 + (group_idx * 0.005), 30.0, -90.0, 40.0]

        req = AnalysisRequest(
            dataset_id="merra2_reanalysis",
            variable_id=var_id,
            start_year=2000,
            end_year=2020,
            bbox=bbox,
            alpha=0.05,
            use_fdr=use_fdr
        )
        payload = {
            "req": req,
            "worker_index": i,
            "use_fdr": use_fdr,
            "token": f"hmac_verified_{i}_{unique_batch}"
        }

        # 1. save_to_db_cache
        save_to_db_cache(analysis_id, payload)

        # 2. load_from_db_cache (verifying HMAC integrity)
        loaded = load_from_db_cache(analysis_id)
        hmac_valid = (
            loaded is not None
            and loaded.get("token") == f"hmac_verified_{i}_{unique_batch}"
            and loaded.get("use_fdr") == use_fdr
        )

        # 3. find_cached_analysis_id for matching use_fdr
        found_id = find_cached_analysis_id(
            dataset_id="merra2_reanalysis",
            variable_id=var_id,
            start_year=2000,
            end_year=2020,
            bbox=bbox,
            alpha=0.05,
            use_fdr=use_fdr
        )
        exact_match = (found_id == analysis_id)

        # 4. Verify no collision with opposite use_fdr query
        opposite_id = find_cached_analysis_id(
            dataset_id="merra2_reanalysis",
            variable_id=var_id,
            start_year=2000,
            end_year=2020,
            bbox=bbox,
            alpha=0.05,
            use_fdr=not use_fdr
        )
        collision = (opposite_id == analysis_id)

        # 5. Verify spatial_cell_cache roundtrip
        cell_lat = round(30.0 + (i * 0.05), 4)
        cell_lon = round(-95.0 + (i * 0.05), 4)
        cell_payload = {
            "lat": cell_lat,
            "lon": cell_lon,
            "slope": round(0.01 * (i + 1), 4),
            "p_value": 0.001,
            "worker_idx": i
        }
        save_cell_to_db_cache(analysis_id, cell_lat, cell_lon, cell_payload)
        cell_loaded = load_cell_from_db_cache(analysis_id, cell_lat, cell_lon)
        cell_valid = (
            cell_loaded is not None
            and cell_loaded.get("worker_idx") == i
            and cell_loaded.get("slope") == round(0.01 * (i + 1), 4)
        )

        return {
            "i": i,
            "hmac_valid": hmac_valid,
            "exact_match": exact_match,
            "collision": collision,
            "cell_valid": cell_valid
        }

    results = []
    operational_errors = []
    general_errors = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=worker_threads) as executor:
        future_to_idx = {executor.submit(stress_worker, i): i for i in range(total_operations)}
        for future in concurrent.futures.as_completed(future_to_idx):
            idx = future_to_idx[future]
            try:
                res = future.result()
                results.append(res)
            except sqlite3.OperationalError as oe:
                operational_errors.append((idx, str(oe)))
                general_errors.append((idx, str(oe)))
            except Exception as exc:
                general_errors.append((idx, str(exc)))

    # Assertions
    # 1. Zero sqlite3.OperationalError exceptions (e.g. database locked, busy timeout)
    assert len(operational_errors) == 0, (
        f"Encountered {len(operational_errors)} sqlite3.OperationalError exceptions: {operational_errors}"
    )
    assert len(general_errors) == 0, (
        f"Encountered {len(general_errors)} thread execution errors: {general_errors}"
    )

    # 2. 100% HMAC verification accuracy across all 80 loads
    assert len(results) == total_operations
    hmac_successes = sum(1 for r in results if r["hmac_valid"])
    assert hmac_successes == total_operations, (
        f"HMAC verification accuracy was {hmac_successes}/{total_operations} ({hmac_successes / total_operations:.1%})"
    )

    # 3. Exact matching of persisted records
    exact_matches = sum(1 for r in results if r["exact_match"])
    assert exact_matches == total_operations, (
        f"Exact match count was {exact_matches}/{total_operations}"
    )

    # 4. Zero cache collisions between use_fdr=True and use_fdr=False
    collisions = sum(1 for r in results if r["collision"])
    assert collisions == 0, (
        f"Detected {collisions} cache collisions between use_fdr=True and use_fdr=False"
    )

    # 5. 100% valid spatial_cell_cache roundtrips
    cell_successes = sum(1 for r in results if r["cell_valid"])
    assert cell_successes == total_operations, (
        f"Spatial cell cache roundtrip accuracy was {cell_successes}/{total_operations} ({cell_successes / total_operations:.1%})"
    )


