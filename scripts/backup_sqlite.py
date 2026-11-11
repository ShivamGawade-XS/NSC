#!/usr/bin/env python3
"""
CLI entry point to create an automated online SQLite backup with PRAGMA integrity verification.
Usage:
    python scripts/backup_sqlite.py [--source DB_PATH] [--dest BACKUP_DIR]
"""
import argparse
import os
from pathlib import Path
import sys

# Ensure backend modules are discoverable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.core.backup import create_sqlite_backup, verify_sqlite_integrity
from app.core.db_cache import get_db_path


def main():
    parser = argparse.ArgumentParser(description="Create verified SQLite backup of Tellura cache DB.")
    parser.add_argument("--source", type=str, default="", help="Path to source SQLite database")
    parser.add_argument("--dest", type=str, default="", help="Directory to store backups")
    parser.add_argument("--retention", type=int, default=10, help="Number of backups to retain")
    args = parser.parse_args()

    source = Path(args.source) if args.source else get_db_path()
    dest = Path(args.dest) if args.dest else source.parent / "backups"

    print(f"[*] Checking source database: {source}")
    integrity = verify_sqlite_integrity(source)
    if not integrity.get("healthy"):
        print(f"[!] Warning: Pre-backup integrity check issue: {integrity}")

    print(f"[*] Creating backup to: {dest}")
    backup_file = create_sqlite_backup(source, dest, max_retained_backups=args.retention)
    print(f"[+] Backup successfully completed: {backup_file}")


if __name__ == "__main__":
    main()
