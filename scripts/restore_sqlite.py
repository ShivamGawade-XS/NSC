#!/usr/bin/env python3
"""
CLI entry point to restore SQLite database from a verified backup with SHA-256 and PRAGMA integrity verification.
Usage:
    python scripts/restore_sqlite.py --backup BACKUP_FILE [--target DB_PATH]
"""
import argparse
from pathlib import Path
import sys

# Ensure backend modules are discoverable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.core.backup import restore_sqlite_database
from app.core.db_cache import get_db_path


def main():
    parser = argparse.ArgumentParser(description="Restore Tellura SQLite cache database from backup.")
    parser.add_argument("--backup", type=str, required=True, help="Path to backup .db file")
    parser.add_argument("--target", type=str, default="", help="Target database path (default: active DB)")
    args = parser.parse_args()

    backup_file = Path(args.backup)
    target = Path(args.target) if args.target else get_db_path()

    print(f"[*] Restoring from {backup_file} to {target}...")
    success = restore_sqlite_database(backup_file, target)
    if success:
        print(f"[+] Successfully restored database to {target}")
    else:
        print("[!] Restore failed.")
        sys.exit(1)


if __name__ == "__main__":
    main()
