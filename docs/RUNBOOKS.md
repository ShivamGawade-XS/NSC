# EarthSift — Production Operations & Incident Runbooks

**System:** EarthSift Scientific Spatiotemporal Climate Discovery Platform  
**Target Audience:** SREs, DevOps Engineers, On-Call Operators  
**Classification:** Operational Runbooks  

---

## 1. High Latency & 503 Capacity Saturation Runbook

### Alert Trigger
- `EarthSiftHighP95Latency` (p95 > 1500ms for 5m)
- `EarthSiftComputeSaturation` (503 Service Unavailable rate > 5% for 2m)

### Symptoms
- Endpoints `/api/v1/analysis` returning HTTP 503 with header `Retry-After: 5`.
- Grafana dashboard showing high Semaphore queue wait or high CPU utilization (>85%).

### Immediate Actions
1. **Inspect Worker Status**:
   ```bash
   docker compose ps
   docker compose logs --tail=100 -f app
   ```
2. **Check In-Flight Concurrency**:
   - Query `/metrics` (Keyed tier or internal loopback): check `database_cache` and memory RSS.
   - Prometheus metric `earthsift_http_requests_in_flight`.
3. **Scale Capacity**:
   - If CPU is saturated by legitimate analysis traffic, adjust `COMPUTE_MAX_CONCURRENT` in `.env`:
     ```env
     COMPUTE_MAX_CONCURRENT=8
     ```
   - Restart or scale container:
     ```bash
     docker compose up -d --build
     ```
4. **Identify Cache-Busting Abuse**:
   - Check access logs for unquantized random float requests.
   - If a specific IP is flooding compute routes, block at edge reverse proxy or adjust rate limit in `app/core/limiter.py`.

---

## 2. SQLite Database Cache Corruption & Restore Runbook

### Alert Trigger
- `database_cache.db-wal` or `earthdata_cache.db` reports `database disk image is malformed`.
- SQLite query raises `sqlite3.DatabaseError: file is encrypted or is not a database`.

### Automated Disaster Recovery Procedure
EarthSift ships with automated hot-backup and restore tooling:

1. **Verify Integrity of Current Database**:
   ```bash
   python scripts/backup_sqlite.py --check-only
   ```
2. **Perform Safe Hot Restore from Backup**:
   - Locate the latest clean timestamped backup in `/app/cache/backups` (or S3/Litestream replica):
     ```bash
     python scripts/restore_sqlite.py --backup-path /app/cache/backups/earthdata_cache_backup_latest.db
     ```
3. **Validate Restored Database**:
   ```bash
   python -c "import sqlite3; conn = sqlite3.connect('backend/data/earthdata_cache.db'); print(conn.execute('PRAGMA integrity_check;').fetchall())"
   # Must output [('ok',)]
   ```
4. **Restart Application Container**:
   ```bash
   docker compose restart app
   ```

---

## 3. Secret & API Key Rotation Runbook

### Keys Governed
- `SECRET_KEY` (Used for HMAC-SHA256 cache signing)
- `EARTHSIFT_API_KEYS` (Comma-separated static keys for Keyed tier)
- `GEMINI_API_KEY` / `OPENAI_API_KEY` (External LLM API keys)

### Rotation Procedures

#### Rotating `EARTHSIFT_API_KEYS` (Zero-Downtime)
1. Generate new 32-character high-entropy secret:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```
2. Append new key to the existing comma-delimited environment variable:
   ```env
   EARTHSIFT_API_KEYS=old_key_hash_abc123,new_key_hash_xyz789
   ```
3. Update environment in Docker / Kubernetes deployment. The application automatically reloads hashes without downtime or restart.
4. Notify keyed clients to migrate to `new_key_hash_xyz789`.
5. Once migrated, remove `old_key_hash_abc123` from `.env`.

#### Rotating `SECRET_KEY` (HMAC Cache Signing)
1. Generate new 64-character secret key.
2. Update `SECRET_KEY` in production environment.
3. Restart application. Note: Old cached payloads signed with previous HMAC key will fail signature validation and be safely re-computed automatically from source data on demand.

---

## 4. External LLM Quota & Budget Depletion Runbook

### Alert Trigger
- `EarthSiftLLMBudgetExhausted` (Daily external LLM calls >= 200)

### System Behavior
- EarthSift's `DailyLLMBudgetTracker` halts outbound calls to Gemini/OpenAI automatically.
- `/api/v1/explain` gracefully degrades to the deterministic, peer-reviewed scientific template. Zero 500 errors are returned to users.
- Metric: `earthsift_llm_calls_total` plateaus at `DAILY_LLM_CALL_LIMIT`.

### Operator Procedure
1. Check current status:
   ```bash
   curl -H "X-API-Key: $KEY" http://localhost:8000/api/v1/metrics
   ```
2. If quota expansion is approved for the day:
   - Temporarily increase limit in `.env`:
     ```env
     DAILY_LLM_CALL_LIMIT=500
     ```
   - Reload application or await automatic 00:00 UTC rollover.
