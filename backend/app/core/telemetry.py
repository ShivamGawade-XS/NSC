"""
NASA Tellura — Production Telemetry & Prometheus Observability Module
Provides standardized Prometheus metrics, SLO tracking, and cardinality-safe endpoint normalization.
"""

import os
import re

import psutil
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    REGISTRY,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)

# 1. Standard HTTP Service Metrics
HTTP_REQUESTS_TOTAL = Counter(
    "earthsift_http_requests_total",
    "Total HTTP requests processed by Tellura API",
    ["method", "endpoint", "status_code"],
)

HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "earthsift_http_request_duration_seconds",
    "HTTP request execution latency in seconds",
    ["method", "endpoint"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)

ACTIVE_REQUESTS = Gauge(
    "earthsift_active_requests",
    "Current active in-flight HTTP requests",
)

# 2. Scientific Core & Analysis Metrics
ANALYSIS_OPERATIONS_TOTAL = Counter(
    "earthsift_analysis_operations_total",
    "Total scientific analysis computations executed",
    ["dataset", "variable", "status"],
)

SPATIAL_CELLS_PROCESSED_TOTAL = Counter(
    "earthsift_spatial_cells_processed_total",
    "Total spatial grid cells computed across all analysis runs",
    ["algorithm"],
)

# 3. Cache Resilience & Performance Metrics
CACHE_HITS_TOTAL = Counter(
    "earthsift_cache_hits_total",
    "Total cache hit events",
    ["tier"],  # memory, sqlite
)

CACHE_MISSES_TOTAL = Counter(
    "earthsift_cache_misses_total",
    "Total cache miss events",
    ["tier"],
)

# 4. System Resource & Headroom Gauges
PROCESS_MEMORY_RSS_BYTES = Gauge(
    "earthsift_process_memory_rss_bytes",
    "Current process resident set size (RSS) memory in bytes",
)


def normalize_metric_endpoint(path: str) -> str:
    """
    Normalizes parameterized URL paths to prevent high-cardinality metric label explosions.
    Example: /analysis/a1b2c3d4-e5f6 -> /analysis/{id}
    """
    if not path:
        return "/"
    # Strip prefix /api/v1 if present for unified metrics
    p = path[7:] if path.startswith("/api/v1") else path
    if not p.startswith("/"):
        p = "/" + p

    # UUID / hash parameter matching
    p = re.sub(r"/[0-9a-fA-F\-]{8,64}", "/{id}", p)
    # File extensions / attachments
    p = re.sub(r"/export/[a-zA-Z0-9_\-]+", "/export/{type}", p)
    return p or "/"


def record_http_request(method: str, path: str, status_code: int, duration_seconds: float) -> None:
    """Records an executed HTTP request in Prometheus counters and histograms."""
    endpoint = normalize_metric_endpoint(path)
    status_str = str(status_code)
    try:
        HTTP_REQUESTS_TOTAL.labels(method=method, endpoint=endpoint, status_code=status_str).inc()
        HTTP_REQUEST_DURATION_SECONDS.labels(method=method, endpoint=endpoint).observe(duration_seconds)
    except Exception:  # noqa: S110
        pass


def update_system_gauges() -> None:
    """Updates memory and resource gauges prior to Prometheus scrape."""
    try:
        proc = psutil.Process(os.getpid())
        PROCESS_MEMORY_RSS_BYTES.set(proc.memory_info().rss)
    except Exception:  # noqa: S110
        pass


def get_prometheus_metrics_payload() -> tuple[bytes, str]:
    """Generates the latest Prometheus exposition format text."""
    update_system_gauges()
    return generate_latest(REGISTRY), CONTENT_TYPE_LATEST
