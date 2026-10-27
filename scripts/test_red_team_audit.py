import os, sys, logging
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath("backend"))

from app.main import app
from app.core.config import Settings
from app.api.endpoints import sanitize_attachment_filename
from app.core.logging_security import SensitiveDataScrubber

client = TestClient(app)

print("=== PHASE 6 RED TEAM PROBE ===")
# 1. SEC-001 Oversized cells (>2500)
large_cells = [{"lat": 30.0, "lon": -100.0, "values": [1.0] * 10} for _ in range(2501)]
r1 = client.post("/api/v1/analysis/custom", json={"cells": large_cells})
assert r1.status_code == 422, f"Expected 422 got {r1.status_code}"
print("1. SEC-001 Oversized cells (>2500): 422 Rejection confirmed")

# 2. SEC-001 Oversized timeseries (>150)
oversized_ts = [{"lat": 30.0, "lon": -100.0, "values": [1.0] * 151}]
r2 = client.post("/api/v1/analysis/custom", json={"cells": oversized_ts})
assert r2.status_code == 422, f"Expected 422 got {r2.status_code}"
print("2. SEC-001 Oversized timeseries (>150): 422 Rejection confirmed")

# 3. SEC-002 Production Secret Key enforcement
try:
    os.environ["SECRET_KEY"] = ""
    Settings._init_secret_key("production")
    raise AssertionError("Failed to raise RuntimeError on empty production SECRET_KEY")
except RuntimeError as exc:
    assert "SECRET_KEY" in str(exc)
    print("3. SEC-002 Production Secret Key enforcement: RuntimeError raised confirmed")

# 4. SEC-004 Filename traversal sanitization
dirty_vars = ["../../etc/passwd", "..\\windows\\system32\\calc", "clean_var"]
for v in dirty_vars:
    fn = sanitize_attachment_filename("earthsift", v, 2000, 2023, "nc")
    assert not any(c in fn for c in ["..", "/", "\\", ":", ";", '"', "\r", "\n"]), f"Unsafe filename: {fn}"
    print(f"4. SEC-004 Filename sanitization result for {v} -> {fn}")

# 5. SEC-005 Cache-Control headers
r_catalog = client.get("/api/v1/datasets")
assert "public" in r_catalog.headers.get("cache-control", "")
r_ana = client.get("/api/v1/analysis/nonexistent_id")
assert "no-store" in r_ana.headers.get("cache-control", "")
print("5. SEC-005 Cache-Control headers: Dynamic path differentiation verified")

# 6. Sensitive Data Logging Scrubber
f = SensitiveDataScrubber()
rec = logging.LogRecord("test", logging.INFO, "test.py", 1, "Logging token: EARTHDATA_PASSWORD=Secret123!", (), None)
f.filter(rec)
assert "Secret123!" not in rec.getMessage()
print("6. Sensitive Data Scrubber: Credentials masked as [REDACTED]")

# 7. Request Body Size Guard (10MB limit)
huge_body = b"a" * (10 * 1024 * 1024 + 1024)
r_huge = client.post("/api/v1/analysis", content=huge_body, headers={"Content-Length": str(len(huge_body)), "Content-Type": "application/json"})
assert r_huge.status_code == 413, f"Expected 413 got {r_huge.status_code}"
print("7. Request Body Size Guard: 413 Payload Too Large confirmed")

print("ALL 7 RED TEAM PROBES PASSED")
