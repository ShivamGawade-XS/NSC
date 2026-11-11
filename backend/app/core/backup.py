"""
Tellura — Automated SQLite WAL Backup & Disaster Recovery System.
Provides online non-blocking SQLite backups via native sqlite3.Connection.backup(),
cryptographic SHA-256 verification, automated PRAGMA integrity checks, and safe restoration.
"""
import hashlib
import logging
import shutil
import sqlite3
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger("Tellura.backup")


def verify_sqlite_integrity(db_path: Path) -> dict[str, Any]:
    """
    Execute PRAGMA integrity_check and PRAGMA foreign_key_check on an SQLite database.
    Returns status dict with boolean 'healthy' and list of any detected issues.
    """
    if not db_path.exists():
        return {"healthy": False, "error": f"Database file not found: {db_path}"}

    try:
        conn = sqlite3.connect(str(db_path), timeout=15.0)
        cur = conn.cursor()

        # 1. Full B-Tree integrity check
        cur.execute("PRAGMA integrity_check;")
        rows = cur.fetchall()
        integrity_ok = len(rows) == 1 and rows[0][0].lower() == "ok"
        integrity_errors = [r[0] for r in rows if r[0].lower() != "ok"]

        # 2. Foreign key consistency check
        cur.execute("PRAGMA foreign_key_check;")
        fk_errors = cur.fetchall()

        conn.close()

        is_healthy = integrity_ok and len(fk_errors) == 0
        return {
            "healthy": is_healthy,
            "integrity_check": "ok" if integrity_ok else "failed",
            "integrity_errors": integrity_errors,
            "foreign_key_errors": [str(e) for e in fk_errors],
            "file_size_bytes": db_path.stat().st_size
        }
    except Exception as exc:
        logger.error("Failed executing integrity check on %s: %s", db_path, exc)
        return {"healthy": False, "error": str(exc)}


def compute_sha256(file_path: Path) -> str:
    """Compute hex-encoded SHA-256 checksum of a file."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def create_sqlite_backup(
    source_db_path: Path,
    backup_dir: Path,
    max_retained_backups: int = 10
) -> Path:
    """
    Perform an online, ACID-consistent backup of an active SQLite database.
    Utilizes SQLite's native backup API, which operates without blocking concurrent WAL readers/writers.
    Validates PRAGMA integrity and writes a companion .sha256 checksum file.
    """
    if not source_db_path.exists():
        raise FileNotFoundError(f"Source database does not exist: {source_db_path}")

    backup_dir.mkdir(parents=True, exist_ok=True)
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    backup_filename = f"earthdata_backup_{timestamp}.db"
    backup_dest = backup_dir / backup_filename

    logger.info("Initiating online SQLite backup from %s to %s", source_db_path, backup_dest)

    # Online backup using native sqlite3 backup engine
    src_conn = sqlite3.connect(str(source_db_path), timeout=30.0)
    dst_conn = sqlite3.connect(str(backup_dest), timeout=30.0)
    try:
        with dst_conn:
            src_conn.backup(dst_conn, pages=100)
    finally:
        dst_conn.close()
        src_conn.close()

    # Verify backup integrity before accepting
    check = verify_sqlite_integrity(backup_dest)
    if not check.get("healthy"):
        backup_dest.unlink(missing_ok=True)
        raise RuntimeError(f"Backup verification failed: {check}")

    # Compute and persist SHA-256 checksum
    checksum = compute_sha256(backup_dest)
    checksum_file = backup_dir / f"{backup_filename}.sha256"
    checksum_file.write_text(f"{checksum}  {backup_filename}\n", encoding="utf-8")

    logger.info(
        "Backup successfully created: %s (size: %d bytes, sha256: %s)",
        backup_dest.name, backup_dest.stat().st_size, checksum[:12]
    )

    # Enforce retention policy: prune oldest backups exceeding max_retained_backups
    existing = sorted(backup_dir.glob("earthdata_backup_*.db"))
    if len(existing) > max_retained_backups:
        for old in existing[:-max_retained_backups]:
            old.unlink(missing_ok=True)
            old.with_suffix(".db.sha256").unlink(missing_ok=True)
            logger.info("Pruned old backup: %s", old.name)

    return backup_dest


def restore_sqlite_database(
    backup_file: Path,
    target_db_path: Path,
    create_safety_backup: bool = True
) -> bool:
    """
    Restore an SQLite database from a verified backup file.
    1. Verifies checksum (if .sha256 exists).
    2. Runs PRAGMA integrity check on backup file.
    3. Moves current target_db to target_db.bak (safety snapshot).
    4. Copies verified backup to target destination.
    """
    if not backup_file.exists():
        raise FileNotFoundError(f"Backup file not found: {backup_file}")

    # Verify checksum if present
    checksum_file = backup_file.with_suffix(".db.sha256")
    if checksum_file.exists():
        expected = checksum_file.read_text(encoding="utf-8").split()[0].strip()
        actual = compute_sha256(backup_file)
        if expected != actual:
            raise ValueError(f"Checksum mismatch: expected {expected}, calculated {actual}")

    # Verify integrity of backup
    check = verify_sqlite_integrity(backup_file)
    if not check.get("healthy"):
        raise RuntimeError(f"Cannot restore from corrupt backup: {check}")

    target_db_path.parent.mkdir(parents=True, exist_ok=True)

    # Create safety backup of existing database
    if create_safety_backup and target_db_path.exists():
        safety_path = target_db_path.with_suffix(".db.bak")
        shutil.copy2(target_db_path, safety_path)
        logger.info("Created pre-restore safety copy: %s", safety_path)

    # Perform restore via copy
    shutil.copy2(backup_file, target_db_path)

    # Remove stale WAL/SHM companion files if present
    wal_file = target_db_path.parent / f"{target_db_path.name}-wal"
    shm_file = target_db_path.parent / f"{target_db_path.name}-shm"
    wal_file.unlink(missing_ok=True)
    shm_file.unlink(missing_ok=True)

    # Verify restored target
    restored_check = verify_sqlite_integrity(target_db_path)
    if not restored_check.get("healthy"):
        raise RuntimeError(f"Target verification failed post-restore: {restored_check}")

    logger.info("Database successfully restored from %s to %s", backup_file, target_db_path)
    return True
