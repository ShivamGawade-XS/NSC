# Tellura — Production Operations & Incident Runbooks

**System:** Tellura Scientific Spatiotemporal Climate Discovery Platform  
**Target Audience:** SREs, DevOps Engineers, On-Call Operators  
**Classification:** Operational Runbooks  

---

## 1. High Latency & 503 Capacity Saturation Runbook

### Alert Trigger
- `TelluraHighP95Latency` (p95 > 1500ms for 5m)
- `TelluraComputeSaturation` (503 Service Unavailable rate > 5% for 2m)

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
Tellura ships with automated hot-backup and restore tooling:

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
- `TELLURA_API_KEYS` (Comma-separated static keys for Keyed tier)
- `GEMINI_API_KEY` / `OPENAI_API_KEY` (External LLM API keys)

### Rotation Procedures

#### Rotating `TELLURA_API_KEYS` (Zero-Downtime)
1. Generate new 32-character high-entropy secret:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```
2. Append new key to the existing comma-delimited environment variable:
   ```env
   TELLURA_API_KEYS=old_key_hash_abc123,new_key_hash_xyz789
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
- `TelluraLLMBudgetExhausted` (Daily external LLM calls >= 200)

### System Behavior
- Tellura's `DailyLLMBudgetTracker` halts outbound calls to Gemini/OpenAI automatically.
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

---

## 5. Reverse Proxy Configuration & Forwarded IP Allowlisting

Tellura configures `FORWARDED_ALLOW_IPS` to safely parse client IP addresses from `X-Forwarded-For` without permitting spoofing attacks.

### Default Configuration
By default, Tellura allows loopback and standard RFC1918 private subnets:
```env
FORWARDED_ALLOW_IPS=127.0.0.1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
```

### Production Proxy Deployments
When deploying behind dedicated reverse proxies or load balancers, restrict `FORWARDED_ALLOW_IPS` strictly to the upstream proxy CIDR blocks:

- **Behind Nginx / HAProxy (Local or VPC)**:
  Set `FORWARDED_ALLOW_IPS=127.0.0.1,10.0.0.0/16` matching your internal ingress tier subnet.
- **Behind AWS Application Load Balancer (ALB)**:
  Set `FORWARDED_ALLOW_IPS` to your VPC public subnet ranges where ALB elastic network interfaces reside (e.g. `10.0.1.0/24,10.0.2.0/24`).
- **Behind Cloudflare**:
  Set `FORWARDED_ALLOW_IPS` to Cloudflare's published IP ranges (or terminate SSL at your edge Nginx gateway and pass internal IP only).

---

## 6. Network Architecture & Port Topology

- **Port 3000 (Local Development Only)**:
  Runs the Vite React HMR frontend development server (`frontend-react/`). Proxies `/api` calls to `:8000`.
- **Port 8000 (Production & API Backend)**:
  The single hardened production Docker container listens exclusively on port `8000`. In production, the FastAPI application serves both:
  1. All REST endpoints (`/api/v1/*`, `/metrics`, `/health`, `/ready`)
  2. The pre-compiled static React SPA (`frontend-react/dist`) via static file fallback.
- **Port 80 / 443 (Edge Gateway)**:
  External HTTPS traffic should terminate at an edge ingress gateway (Nginx/Traefik/ALB) and reverse-proxy to Tellura on port `8000`.

---

## 7. Data Retention & Privacy Purge Schedule

Tellura enforces automated and scheduled privacy cleanup routines:
1. **SQLite Analysis Cache**:
   Deterministic LRU eviction automatically purges the oldest 20% of entries when cached records exceed `CACHE_MAX_SIZE` (default 256) or total storage exceeds `CACHE_MAX_BYTES` (default 96MB).
2. **Contact Inquiry Inbox**:
   Inquiries saved to `cache/inbox/*.json` have a 90-day retention schedule.
   Purge command:
   ```bash
   python -c "import time, pathlib; p = pathlib.Path('cache/inbox'); cutoff = time.time() - 90*86400; [f.unlink() for f in p.glob('*.json') if f.stat().st_mtime < cutoff]"
   ```
3. **Telemetry Logs**:
   Telemetry stored in `telemetry_events` table contains zero PII (anonymized event names and page views only). Events older than 60 days are vacuumed during database maintenance checkpoints.
