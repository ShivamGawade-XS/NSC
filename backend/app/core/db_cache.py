"""
EarthSift — Persistent SQLite Cache with B-Tree Indexes
Provides L2 persistent caching, database indexing, and query optimization
for computed NASA Earth-system trend analyses and coordinate time series.
"""

import hashlib
import hmac
import json
import logging
import os
import sqlite3
import threading
import time
import types
import zlib
from pathlib import Path
from typing import Any, cast

import numpy as np
from pydantic import BaseModel

from app.core.config import settings
from app.schemas.analysis import AnalysisRequest, AnalysisSummary, CustomAnalysisRequest

logger = logging.getLogger("earthsift.db_cache")

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
        conn.execute("PRAGMA busy_timeout=30000;")
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
        conn.execute("DROP INDEX IF EXISTS idx_ami_lookup;")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ami_lookup ON analysis_metadata_index(dataset_id, variable_id, start_year, end_year, bbox_min_lat, bbox_max_lat, bbox_min_lon, bbox_max_lon, alpha, fdr_controlled);")
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


def _serialize_cache_payload(payload: dict[str, Any]) -> bytes:
    """
    Deterministic JSON encoder preventing CWE-502 insecure deserialization.
    Transforms Pydantic models, NumPy arrays, and scalars into schema-tagged JSON.
    """
    def _default_encoder(obj: Any) -> Any:
        if isinstance(obj, AnalysisRequest):
            return {"__pydantic_AnalysisRequest__": obj.model_dump()}
        if isinstance(obj, AnalysisSummary):
            return {"__pydantic_AnalysisSummary__": obj.model_dump()}
        if isinstance(obj, BaseModel):
            return {f"__pydantic_{obj.__class__.__name__}__": obj.model_dump()}
        if isinstance(obj, types.SimpleNamespace):
            return {"__simple_namespace__": vars(obj)}
        if isinstance(obj, np.ndarray):
            return {
                "__ndarray__": obj.tolist(),
                "dtype": str(obj.dtype),
                "shape": list(obj.shape)
            }
        if isinstance(obj, np.generic):
            return obj.item()
        if isinstance(obj, (bytes, bytearray)):
            return {"__bytes__": obj.hex()}
        if isinstance(obj, Path):
            return str(obj)
        raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")

    return json.dumps(payload, default=_default_encoder, sort_keys=True).encode("utf-8")


def _deserialize_cache_payload(raw_bytes: bytes) -> dict[str, Any]:
    """
    Secure JSON decoder reconstructing Pydantic models and NumPy arrays
    from schema-tagged dictionaries without executing arbitrary code.
    """
    def _object_hook(d: dict[str, Any]) -> Any:
        if "__pydantic_AnalysisRequest__" in d:
            return AnalysisRequest(**d["__pydantic_AnalysisRequest__"])
        if "__pydantic_CustomAnalysisRequest__" in d:
            return CustomAnalysisRequest(**d["__pydantic_CustomAnalysisRequest__"])
        if "__pydantic_AnalysisSummary__" in d:
            return AnalysisSummary(**d["__pydantic_AnalysisSummary__"])
        if "__ndarray__" in d:
            arr = np.array(d["__ndarray__"], dtype=d.get("dtype"))
            shape = d.get("shape")
            if shape is not None:
                arr = arr.reshape(shape)
            return arr
        if "__simple_namespace__" in d:
            return types.SimpleNamespace(**d["__simple_namespace__"])
        if "__bytes__" in d:
            return bytes.fromhex(d["__bytes__"])
        return d

    text = raw_bytes.decode("utf-8")
    return cast(dict[str, Any], json.loads(text, object_hook=_object_hook))


def save_to_db_cache(analysis_id: str, payload: dict[str, Any]) -> None:
    """
    Save analysis to persistent SQLite database with compressed payload
    and indexed query dimensions.
    """
    try:
        req = payload.get("req")
        if not req:
            return

        dataset_id = getattr(req, "dataset_id", getattr(req, "dataset_name", "unknown"))
        variable_id = getattr(req, "variable_id", getattr(req, "variable_name", "unknown"))
        start_year = int(getattr(req, "start_year", 2000))
        end_year = int(getattr(req, "end_year", 2023))
        bbox = getattr(req, "bbox", None) or [-90.0, -180.0, 90.0, 180.0]
        alpha = float(getattr(req, "alpha", 0.05))
        use_fdr = getattr(req, "use_fdr", getattr(req, "apply_fdr", True))
        fdr_controlled = 1 if use_fdr else 0

        # Compress payload using zlib for minimal disk footprint and cryptographically sign
        json_bytes = _serialize_cache_payload(payload)
        raw_compressed = zlib.compress(json_bytes, level=6)
        hmac_key = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
        sig = hmac.new(hmac_key, raw_compressed, hashlib.sha256).digest()
        signed_bytes = sig + raw_compressed
        now = time.time()

        conn = get_db_connection()
        pruned = False
        with _DB_LOCK:
            # Deterministic LRU pruning: Evict oldest 20% when count >= CACHE_MAX_SIZE or total payload >= 80MB
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*), COALESCE(SUM(LENGTH(payload_compressed)), 0) FROM analysis_metadata_index;")
            rec_count, total_bytes = cur.fetchone()
            max_bytes = 80 * 1024 * 1024  # 80 MB threshold for bounded 128MB tmpfs

            if rec_count >= settings.CACHE_MAX_SIZE or total_bytes >= max_bytes:
                prune_count = max(1, int(rec_count * 0.20))
                logger.info(
                    "Deterministic LRU prune triggered: %d records, %d bytes (limit: %d rec, %d bytes). Evicting %d oldest records.",
                    rec_count, total_bytes, settings.CACHE_MAX_SIZE, max_bytes, prune_count
                )
                cur.execute("""
                    DELETE FROM spatial_cell_cache
                    WHERE analysis_id IN (
                        SELECT analysis_id FROM analysis_metadata_index
                        ORDER BY last_accessed ASC
                        LIMIT ?
                    );
                """, (prune_count,))
                cur.execute("""
                    DELETE FROM analysis_metadata_index
                    WHERE analysis_id IN (
                        SELECT analysis_id FROM analysis_metadata_index
                        ORDER BY last_accessed ASC
                        LIMIT ?
                    );
                """, (prune_count,))
                pruned = True

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
                signed_bytes
            ))
            conn.commit()

            if pruned:
                try:
                    conn.execute("PRAGMA wal_checkpoint(TRUNCATE);")
                    conn.execute("PRAGMA incremental_vacuum;")
                except Exception:
                    try:
                        conn.execute("PRAGMA wal_checkpoint(PASSIVE);")
                    except Exception:
                        pass
    except Exception as exc:
        try:
            conn.rollback()
        except Exception:
            pass
        logger.error("Error saving cache for analysis_id=%s: %s", analysis_id, exc)


def load_from_db_cache(analysis_id: str) -> dict[str, Any] | None:
    """
    Retrieve analysis from persistent SQLite database by analysis_id.
    Cryptographically verifies HMAC signature before deserialization.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT payload_compressed FROM analysis_metadata_index WHERE analysis_id = ?;", (analysis_id,))
        row = cur.fetchone()
        if not row or not row[0]:
            return None

        data_bytes = row[0]
        if len(data_bytes) <= 32:
            logger.error("Security alert: cache payload too small (<=32 bytes) for analysis_id=%s", analysis_id)
            return None

        hmac_key = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
        sig = data_bytes[:32]
        raw_payload = data_bytes[32:]
        expected_sig = hmac.new(hmac_key, raw_payload, hashlib.sha256).digest()

        if not hmac.compare_digest(sig, expected_sig):
            logger.error("HMAC-SHA256 verification failed for analysis_id=%s", analysis_id)
            return None

        if hmac.compare_digest(sig, expected_sig):
            decompressed = zlib.decompress(raw_payload)
            payload = _deserialize_cache_payload(decompressed)

            with _DB_LOCK, conn:
                conn.execute("""
                    UPDATE analysis_metadata_index
                    SET last_accessed = ?, access_count = access_count + 1
                    WHERE analysis_id = ?;
                """, (time.time(), analysis_id))

            return payload
    except Exception as exc:
        logger.error("Error loading cache for analysis_id=%s: %s", analysis_id, exc)
        return None


def find_cached_analysis_id(
    dataset_id: str,
    variable_id: str,
    start_year: int,
    end_year: int,
    bbox: list[float],
    alpha: float,
    use_fdr: bool = True
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
              AND fdr_controlled = ?
            ORDER BY created_at DESC
            LIMIT 1;
        """, (
            dataset_id, variable_id, start_year, end_year,
            float(bbox[1]), float(bbox[3]), float(bbox[0]), float(bbox[2]),
            float(alpha), 1 if use_fdr else 0
        ))
        row = cur.fetchone()
        return row[0] if row else None
    except Exception:
        return None


def save_cell_to_db_cache(
    analysis_id: str,
    lat: float,
    lon: float,
    cell_payload: dict[str, Any]
) -> None:
    """
    Save coordinate drilldown cell to persistent spatial_cell_cache table
    with HMAC-SHA256 signed and compressed JSON payload.
    """
    try:
        cell_key = f"{analysis_id}:{lat:.4f}:{lon:.4f}"
        slope = cell_payload.get("slope")
        p_val = cell_payload.get("p_value")
        q_val = cell_payload.get("q_value")
        sig_raw = cell_payload.get("significant", cell_payload.get("is_significant_fdr"))
        significant = (1 if sig_raw else 0) if sig_raw is not None else None
        cp_year = cell_payload.get("changepoint_year")

        json_bytes = _serialize_cache_payload(cell_payload)
        raw_compressed = zlib.compress(json_bytes, level=6)
        hmac_key = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
        sig = hmac.new(hmac_key, raw_compressed, hashlib.sha256).digest()
        signed_bytes = sig + raw_compressed
        now = time.time()

        conn = get_db_connection()
        with _DB_LOCK:
            conn.execute("""
                INSERT OR REPLACE INTO spatial_cell_cache (
                    cell_key, analysis_id, lat, lon,
                    slope, p_value, q_value, significant, changepoint_year,
                    data_compressed, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                cell_key, analysis_id, float(lat), float(lon),
                float(slope) if slope is not None else None,
                float(p_val) if p_val is not None else None,
                float(q_val) if q_val is not None else None,
                significant,
                int(cp_year) if cp_year is not None else None,
                signed_bytes,
                now
            ))
            conn.commit()
    except Exception as exc:
        try:
            conn.rollback()
        except Exception:
            pass
        logger.error("Error saving cell cache for key=%s: %s", f"{analysis_id}:{lat:.4f}:{lon:.4f}", exc)


def load_cell_from_db_cache(analysis_id: str, lat: float, lon: float) -> dict[str, Any] | None:
    """
    Retrieve coordinate drilldown cell from persistent spatial_cell_cache table.
    Cryptographically verifies HMAC signature before deserialization.
    """
    cell_key = f"{analysis_id}:{lat:.4f}:{lon:.4f}"
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT data_compressed FROM spatial_cell_cache WHERE cell_key = ?;", (cell_key,))
        row = cur.fetchone()
        if not row or not row[0]:
            return None

        data_bytes = row[0]
        if len(data_bytes) <= 32:
            logger.error("Security alert: cell cache payload too small (<=32 bytes) for key=%s", cell_key)
            return None

        hmac_key = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
        sig = data_bytes[:32]
        raw_payload = data_bytes[32:]
        expected_sig = hmac.new(hmac_key, raw_payload, hashlib.sha256).digest()

        if not hmac.compare_digest(sig, expected_sig):
            logger.error("HMAC-SHA256 verification failed for cell_key=%s", cell_key)
            return None

        if hmac.compare_digest(sig, expected_sig):
            decompressed = zlib.decompress(raw_payload)
            return _deserialize_cache_payload(decompressed)
    except Exception as exc:
        logger.error("Error loading cell cache for key=%s: %s", cell_key, exc)
        return None


def get_cache_db_stats() -> dict[str, Any]:
    """Return database telemetry, record counts, and index sizes."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*), COALESCE(SUM(LENGTH(payload_compressed)), 0) FROM analysis_metadata_index;")
        count, total_bytes = cur.fetchone()

        cur.execute("SELECT COUNT(*) FROM spatial_cell_cache;")
        cell_count = cur.fetchone()[0]

        file_size = DB_PATH.stat().st_size if DB_PATH.exists() else 0
        return {
            "db_path": str(DB_PATH),
            "indexed_records": count,
            "indexed_cells": cell_count,
            "compressed_payload_bytes": total_bytes,
            "database_file_size_bytes": file_size,
            "wal_mode_active": True
        }
    except Exception as exc:
        return {"error": str(exc), "db_path": str(DB_PATH)}
