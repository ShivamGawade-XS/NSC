"""
Tests for F-003: Persistent Docker Cache Volume replacing ephemeral tmpfs.
Asserts compose configuration integrity, non-root user execution,
and persistent SQLite cache survival across simulated process/container restarts.
"""
import os
from pathlib import Path
import pytest
import yaml

from app.core.db_cache import (
    close_db_connection,
    get_db_connection,
    init_db,
    load_from_db_cache,
    save_to_db_cache,
)


def test_docker_compose_cache_volume_replaces_tmpfs():
    """Verify docker-compose.yml mounts earthsift-cache volume instead of ephemeral tmpfs."""
    compose_path = Path(__file__).resolve().parent.parent.parent / "docker-compose.yml"
    assert compose_path.exists(), "docker-compose.yml must exist"

    with open(compose_path, "r", encoding="utf-8") as f:
        compose_cfg = yaml.safe_load(f)

    service = compose_cfg.get("services", {}).get("earthsift", {})
    assert service, "earthsift service must be defined in compose"

    # Verify user is non-root (10001:10001)
    assert service.get("user") == "10001:10001", "Service must run as non-root UID 10001"

    # Verify /app/cache is NOT in tmpfs
    tmpfs_mounts = service.get("tmpfs", [])
    cache_tmpfs = [m for m in tmpfs_mounts if "/app/cache" in m]
    assert len(cache_tmpfs) == 0, f"/app/cache must NOT be in tmpfs: {cache_tmpfs}"

    # Verify /tmp is retained in tmpfs
    tmp_tmpfs = [m for m in tmpfs_mounts if "/tmp" in m]
    assert len(tmp_tmpfs) > 0, "/tmp should remain mounted as tmpfs for ephemeral files"

    # Verify persistent volume mounted to /app/cache
    volumes = service.get("volumes", [])
    cache_vol = [v for v in volumes if "/app/cache" in v]
    assert len(cache_vol) == 1, f"Expected 1 persistent cache volume mount, found: {cache_vol}"
    assert "earthsift-cache" in cache_vol[0]

    # Verify root level volumes define earthsift-cache
    root_volumes = compose_cfg.get("volumes", {})
    assert "earthsift-cache" in root_volumes, "earthsift-cache must be defined in top-level volumes"


def test_sqlite_cache_survival_across_simulated_restart(tmp_path, monkeypatch):
    """
    Simulate a container stop/start: write to disk, teardown in-memory connection pool,
    re-initialize on startup, and assert full cache record and signature survival.
    """
    test_db_dir = tmp_path / "cache"
    test_db_dir.mkdir(parents=True, exist_ok=True)
    test_db = test_db_dir / "earthdata_cache.db"

    monkeypatch.setenv("EARTHSIFT_DB_PATH", str(test_db))
    # Reset existing connection to switch to test_db
    close_db_connection()

    # Phase 1: Initialize DB and write analysis
    init_db()

    from app.schemas.analysis import AnalysisRequest
    req = AnalysisRequest(
        dataset_id="nasa_power",
        variable_id="T2M",
        start_year=2000,
        end_year=2023,
        bbox=[-100.0, 30.0, -90.0, 40.0],
        alpha=0.05,
        use_fdr=True
    )
    analysis_id = "test-survival-analysis-001"
    sample_payload = {
        "analysis_id": analysis_id,
        "req": req,
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "slopes": [[0.12, 0.34], [0.56, 0.78]],
        "p_values": [[0.01, 0.02], [0.03, 0.04]],
        "metadata": {"test": "persistence-verification"}
    }

    save_to_db_cache(analysis_id, sample_payload)

    # Phase 2: Simulate container shutdown - explicitly close SQLite connections
    close_db_connection()

    # Phase 3: Simulate container startup in fresh process context
    # Reconnect to disk file
    loaded = load_from_db_cache(analysis_id)
    assert loaded is not None, "Cache record must survive container restart"
    assert loaded["analysis_id"] == analysis_id
    assert loaded["req"].variable_id == "T2M"
    assert loaded["slopes"] == sample_payload["slopes"]
    assert loaded["metadata"] == sample_payload["metadata"]
    close_db_connection()
