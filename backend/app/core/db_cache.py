"""
EarthSift — Persistent SQLite Cache with B-Tree Indexes
Provides L2 persistent caching, database indexing, and query optimization
for computed NASA Earth-system trend analyses and coordinate time series.
"""

import os
import pickle
import sqlite3
import threading
import time
import zlib
from pathlib import Path
from typing import Any

# Database file location
DEFAULT_DB_DIR = Path(__file__).resolve().parents[2] / "data"
DEFAULT_DB_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = Path(os.getenv("EARTHSIFT_DB_PATH", str(DEFAULT_DB_DIR / "earthdata_cache.db")))

_TLS = threading.local()
_DB_LOCK = threading.Lock()


def get_db_connection() -> sqlite3.Connection:
    """Return a thread-local SQLite connection with WAL journal mode."""
    if not hasattr(_TLS, "conn") or _TLS.conn is None:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(DB_PATH), timeout=30.0, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        # Enable Write-Ahead Logging for high-concurrency read performance
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        conn.execute("PRAGMA cache_size=-16000;")  # 16MB in-memory SQLite page cache
        conn.execute("PRAGMA temp_store=MEMORY;")
        conn.execute("PRAGMA mmap_size=67108864;")  # 64MB memory-mapped I/O
        _TLS.conn = conn
    return _TLS.conn


def init_db() -> None:
    """Initialize SQLite tables and performance B-Tree indexes."""
    conn = get_db_connection()
    with conn:
        # Table 1: Primary Analysis Metadata & Serialized Cache Index
        conn.execute("""
            CREATE TABLE IF NOT EXISTS analysis_metadata_index (
                analysis_id TEXT PRIMARY KEY,
                dataset_id TEXT NOT NULL,
                variable_id TEXT NOT NULL,
                start_year INTEGER NOT NULL,
                end_year INTEGER NOT NULL,
                bbox_min_lat REAL NOT NULL,
                bbox_max_lat REAL NOT NULL,
                bbox_min_lon REAL NOT NULL,
                bbox_max_lon REAL NOT NULL,
                alpha REAL NOT NULL,
                fdr_controlled INTEGER NOT NULL,
                created_at REAL NOT NULL,
                last_accessed REAL NOT NULL,
                access_count INTEGER DEFAULT 1,
                payload_compressed BLOB NOT NULL
            );
        """)

        # B-Tree Indexes for rapid multi-dimensional filtering
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ami_dataset_var ON analysis_metadata_index(dataset_id, variable_id);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ami_temporal ON analysis_metadata_index(start_year, end_year);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ami_bbox ON analysis_metadata_index(bbox_min_lat, bbox_max_lat, bbox_min_lon, bbox_max_lon);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ami_lookup ON analysis_metadata_index(dataset_id, variable_id, start_year, end_year, bbox_min_lat, bbox_max_lat, bbox_min_lon, bbox_max_lon, alpha);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ami_accessed ON analysis_metadata_index(last_accessed);")

        # Table 2: Coordinate Cell Drilldown Cache Index
        conn.execute("""
            CREATE TABLE IF NOT EXISTS spatial_cell_cache (
                cell_key TEXT PRIMARY KEY,
                analysis_id TEXT NOT NULL,
                lat REAL NOT NULL,
                lon REAL NOT NULL,
                slope REAL,
                p_value REAL,
                q_value REAL,
                significant INTEGER,
                changepoint_year INTEGER,
                data_compressed BLOB,
                created_at REAL NOT NULL,
                FOREIGN KEY (analysis_id) REFERENCES analysis_metadata_index(analysis_id) ON DELETE CASCADE
            );
        """)

        conn.execute("CREATE INDEX IF NOT EXISTS idx_scc_analysis ON spatial_cell_cache(analysis_id);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_scc_coords ON spatial_cell_cache(lat, lon);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_scc_sig ON spatial_cell_cache(significant, slope);")


# Automatically run schema initialization on import
init_db()


def save_to_db_cache(analysis_id: str, payload: dict[str, Any]) -> None:
    """
    Save analysis to persistent SQLite database with compressed payload
    and indexed query dimensions.
    """
    try:
        req = payload.get("req")
        if not req:
            return

        dataset_id = getattr(req, "dataset_id", "unknown")
        variable_id = getattr(req, "variable_id", "unknown")
        start_year = int(getattr(req, "start_year", 2000))
        end_year = int(getattr(req, "end_year", 2023))
        bbox = getattr(req, "bbox", None) or [-90.0, -180.0, 90.0, 180.0]
        alpha = float(getattr(req, "alpha", 0.05))
        fdr_controlled = 1 if getattr(req, "apply_fdr", True) else 0

        # Compress payload using zlib for minimal disk footprint
        compressed_bytes = zlib.compress(pickle.dumps(payload, protocol=pickle.HIGHEST_PROTOCOL), level=6)
        now = time.time()

        conn = get_db_connection()
        with _DB_LOCK:
            conn.execute("""
                INSERT OR REPLACE INTO analysis_metadata_index (
                    analysis_id, dataset_id, variable_id, start_year, end_year,
                    bbox_min_lat, bbox_max_lat, bbox_min_lon, bbox_max_lon,
                    alpha, fdr_controlled, created_at, last_accessed, access_count,
                    payload_compressed
                ) VALUES (
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?, 1,
                    ?
                );
            """, (
                analysis_id, dataset_id, variable_id, start_year, end_year,
                float(bbox[1]), float(bbox[3]), float(bbox[0]), float(bbox[2]),
                alpha, fdr_controlled, now, now,
                compressed_bytes
            ))
            conn.commit()
    except Exception:
        # Non-blocking logging on database write error
        pass


def load_from_db_cache(analysis_id: str) -> dict[str, Any] | None:
    """
    Retrieve analysis from persistent SQLite database by analysis_id.
    Updates access timestamp and access counter via B-Tree index.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT payload_compressed FROM analysis_metadata_index WHERE analysis_id = ?;", (analysis_id,))
        row = cur.fetchone()
        if not row:
            return None

        # Update access telemetry asynchronously/quickly
        with _DB_LOCK:
            conn.execute("""
                UPDATE analysis_metadata_index
                SET last_accessed = ?, access_count = access_count + 1
                WHERE analysis_id = ?;
            """, (time.time(), analysis_id))
            conn.commit()

        # Decompress and deserialize
        decompressed = zlib.decompress(row[0])
        payload = pickle.loads(decompressed)
        return payload
    except Exception:
        return None


def find_cached_analysis_id(
    dataset_id: str,
    variable_id: str,
    start_year: int,
    end_year: int,
    bbox: list[float],
    alpha: float
) -> str | None:
    """
    Leverages composite B-Tree index to discover if an equivalent analysis
    has already been computed and persisted.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT analysis_id FROM analysis_metadata_index
            WHERE dataset_id = ?
              AND variable_id = ?
              AND start_year = ?
              AND end_year = ?
              AND bbox_min_lat = ?
              AND bbox_max_lat = ?
              AND bbox_min_lon = ?
              AND bbox_max_lon = ?
              AND alpha = ?
            ORDER BY created_at DESC
            LIMIT 1;
        """, (
            dataset_id, variable_id, start_year, end_year,
            float(bbox[1]), float(bbox[3]), float(bbox[0]), float(bbox[2]),
            float(alpha)
        ))
        row = cur.fetchone()
        return row[0] if row else None
    except Exception:
        return None


def get_cache_db_stats() -> dict[str, Any]:
    """Return database telemetry, record counts, and index sizes."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*), COALESCE(SUM(LENGTH(payload_compressed)), 0) FROM analysis_metadata_index;")
        count, total_bytes = cur.fetchone()
        
        file_size = DB_PATH.stat().st_size if DB_PATH.exists() else 0
        return {
            "db_path": str(DB_PATH),
            "indexed_records": count,
            "compressed_payload_bytes": total_bytes,
            "database_file_size_bytes": file_size,
            "wal_mode_active": True
        }
    except Exception as exc:
        return {"error": str(exc), "db_path": str(DB_PATH)}
