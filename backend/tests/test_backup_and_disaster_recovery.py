"""
Tests for Item 9: Automated SQLite WAL Backup & Disaster Recovery.
Asserts online non-blocking backup generation, PRAGMA integrity verification,
cryptographic SHA-256 validation, retention rotation, and full disaster restore cycle.
"""
import sqlite3
from pathlib import Path
import pytest

from app.core.backup import (
    compute_sha256,
    create_sqlite_backup,
    restore_sqlite_database,
    verify_sqlite_integrity,
)


def _init_test_db(db_path: Path):
    """Create a test SQLite database with tables and sample records."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    with conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA foreign_keys=ON;")
        conn.execute("""
            CREATE TABLE test_records (
                id TEXT PRIMARY KEY,
                val REAL NOT NULL
            );
        """)
        for i in range(25):
            conn.execute("INSERT INTO test_records VALUES (?, ?);", (f"rec_{i}", float(i * 1.5)))
    conn.close()


def test_verify_sqlite_integrity_healthy_and_corrupt(tmp_path):
    """Verify integrity check passes on valid DB and detects corrupted files."""
    db = tmp_path / "healthy.db"
    _init_test_db(db)

    res = verify_sqlite_integrity(db)
    assert res["healthy"] is True
    assert res["integrity_check"] == "ok"
    assert len(res["integrity_errors"]) == 0

    # Create intentionally corrupted SQLite file
    corrupt_db = tmp_path / "corrupt.db"
    corrupt_db.write_bytes(b"SQLite format 3\x00corrupted-junk-bytes" + b"\xff" * 1024)
    corrupt_res = verify_sqlite_integrity(corrupt_db)
    assert corrupt_res["healthy"] is False


def test_create_sqlite_backup_and_checksum(tmp_path):
    """Verify backup creates valid snapshot and matching .sha256 file."""
    src = tmp_path / "live.db"
    backup_dir = tmp_path / "backups"
    _init_test_db(src)

    backup_path = create_sqlite_backup(src, backup_dir, max_retained_backups=5)
    assert backup_path.exists()
    assert backup_path.stat().st_size > 0

    # Verify sha256 checksum file matches
    checksum_file = backup_path.with_suffix(".db.sha256")
    assert checksum_file.exists()
    expected_hash = compute_sha256(backup_path)
    recorded_hash = checksum_file.read_text(encoding="utf-8").split()[0].strip()
    assert expected_hash == recorded_hash

    # Verify backup passes integrity
    check = verify_sqlite_integrity(backup_path)
    assert check["healthy"] is True


def test_backup_retention_pruning(tmp_path):
    """Verify retention policy rotates out oldest backups."""
    src = tmp_path / "source.db"
    backup_dir = tmp_path / "retention_test"
    _init_test_db(src)

    # Generate 6 backups with max_retained_backups=3
    for _ in range(6):
        create_sqlite_backup(src, backup_dir, max_retained_backups=3)

    backups = list(backup_dir.glob("earthdata_backup_*.db"))
    assert len(backups) <= 3, f"Expected <= 3 backups retained, found {len(backups)}"


def test_disaster_recovery_restore_cycle(tmp_path):
    """
    Full Disaster Recovery Test:
    1. Populate live database.
    2. Take backup.
    3. Simulate catastrophic corruption / deletion of live DB.
    4. Restore from backup.
    5. Assert all records survive and integrity is validated.
    """
    live_db = tmp_path / "live" / "earthdata_cache.db"
    backup_dir = tmp_path / "backups"
    _init_test_db(live_db)

    # 1. Take backup
    backup_path = create_sqlite_backup(live_db, backup_dir)

    # 2. Simulate disaster: overwrite live database with garbage
    live_db.write_bytes(b"CORRUPTED DISK SECTOR OVERWRITE ERROR")

    # 3. Restore database from backup
    success = restore_sqlite_database(backup_path, live_db, create_safety_backup=True)
    assert success is True

    # 4. Verify safety backup of corrupted file was preserved
    safety_bak = live_db.with_suffix(".db.bak")
    assert safety_bak.exists()

    # 5. Verify restored database is completely intact and readable
    check = verify_sqlite_integrity(live_db)
    assert check["healthy"] is True

    conn = sqlite3.connect(str(live_db))
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM test_records;")
    count = cur.fetchone()[0]
    conn.close()
    assert count == 25, f"Expected 25 restored records, got {count}"


def test_restore_rejects_tampered_backup(tmp_path):
    """Verify restore refuses to execute if backup checksum has been tampered with."""
    src = tmp_path / "source.db"
    backup_dir = tmp_path / "tamper_test"
    target = tmp_path / "target.db"
    _init_test_db(src)

    backup_path = create_sqlite_backup(src, backup_dir)

    # Tamper with the backup file bytes
    with open(backup_path, "ab") as f:
        f.write(b"\x00\x00TAMPER")

    with pytest.raises(ValueError, match="Checksum mismatch"):
        restore_sqlite_database(backup_path, target)
