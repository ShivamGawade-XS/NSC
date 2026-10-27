# NASA Space Apps Challenge 2026: Authorized Security Review & Penetration Testing Findings

**Project:** EarthSift — Be An Earth System Trend Detective!  
**Competition:** NASA Space Apps Challenge 2026  
**Assessment Type:** Authorized Read-Only Application Security Architecture & Penetration Testing Review  
**Execution Phase:** Phase 9 / Stage C (Read-Only Assessment — Code Modifications Frozen)  
**Date:** 2026-10-24  
**Assessor:** Senior Application Security Engineer & Authorized Penetration Tester  
**Remediation Status:** All findings reported in Point Form as OPEN — No patches applied during this assessment.

---

## Scope & Testing Boundaries

- **Authorized Scope:** Local application codebase, local FastAPI endpoints, and synthetic test suites within the workspace (`backend/`, `frontend-react/`).
- **Excluded / Out-of-Scope:** NASA production servers, public third-party APIs (NASA POWER live endpoints, NASA Earthdata Cloud, Google Gemini, OpenAI), denial-of-service volumetric flooding, destructive file system attacks.
- **Rules of Engagement:** Strictly non-destructive, read-only inspection; no credential leakage; all findings preserved as Open.

---

## Security Findings (Point Form)

### Finding ID: SEC-001
- **Title:** Unbounded Coordinate Cell Array in Custom Analysis Endpoint Leading to Algorithmic Complexity / Memory Denial of Service
- **Severity:** Medium
- **Confidence:** Confirmed
- **Affected file or endpoint:** `POST /analysis/custom`, `backend/app/schemas/analysis.py:96-102`, `backend/app/api/endpoints.py:344-546`
- **Evidence:** In `CustomAnalysisRequest` (`backend/app/schemas/analysis.py`), `cells: list[CustomCellInput]` has no upper bound constraint (`max_length` or `Field(max_length=...)`). In `run_custom_analysis` (`endpoints.py`), the endpoint constructs an $N \times N$ pairwise Haversine distance matrix for spatial autocorrelation and LISA cluster evaluation (`dist_matrix = haversine_distances(coords, coords) * 6371.0`). For an input array of 20,000 cells (which fits inside the 2 MB payload size limit), an array of $(20{,}000)^2 = 400{,}000{,}000$ double-precision floats is allocated, demanding $\sim 3.2\text{ GB}$ of RAM, triggering process memory exhaustion (OOM kill).
- **Attack preconditions:** Network access to the `POST /analysis/custom` endpoint within standard rate limit quota (20 requests/minute).
- **Potential impact:** High CPU usage and worker termination via Out-Of-Memory (OOM) killer, resulting in denial of service for other concurrent researchers.
- **Reproduction:** Submit an authorized HTTP POST to `/analysis/custom` containing a JSON payload with 15,000 minimal coordinate entries within the 2 MB payload limit.
- **Evidence limitations:** Tested in controlled test harness; process memory spike verified via `psutil` profiling without crashing host operating system.
- **Recommended remediation direction:** Apply a strict Pydantic list length constraint (e.g., `Field(max_length=2500)`) to `cells` in `CustomAnalysisRequest` and enforce early rejection if $N > 2500$.
- **Status:** Open — not fixed.

---

### Finding ID: SEC-002
- **Title:** In-Memory Ephemeral `SECRET_KEY` Generation in Production Leading to Distributed Cache Invalidation in Multi-Worker Environments
- **Severity:** Medium
- **Confidence:** Confirmed
- **Affected file or endpoint:** `backend/app/core/config.py:46-61`, `backend/app/core/db_cache.py:196-294`
- **Evidence:** When `ENVIRONMENT=production` and `SECRET_KEY` is not explicitly set in the deployment environment, `Settings._init_secret_key()` generates an ephemeral random hex token via `secrets.token_hex(32)`. If the application is launched under a multi-worker ASGI process manager (e.g., Gunicorn/Uvicorn with 4 worker processes), each worker process generates an isolated, independent secret key in its local process memory. When Worker 1 writes and HMAC-signs a cache entry in `earthdata_cache.db`, subsequent read requests routed to Worker 2 fail HMAC verification (`hmac.compare_digest` returns False), causing all cached analyses to be rejected as tampered or dropped.
- **Attack preconditions:** Production deployment with $>1$ worker process where `SECRET_KEY` was omitted from environment variables.
- **Potential impact:** Intermittent cache misses, unexpected dropped calculations, and elevated compute overhead across cluster workers.
- **Reproduction:** Spawn two independent Python processes importing `settings` without setting `SECRET_KEY` in environment; compare `settings.SECRET_KEY` across both processes.
- **Evidence limitations:** Does not permit unauthorized data access, but directly degrades system integrity and caching availability.
- **Recommended remediation direction:** Enforce that in `ENVIRONMENT=production`, if `SECRET_KEY` is missing, the application fails to start with an explicit, halting configuration error rather than falling back to an unshared ephemeral secret.
- **Status:** Open — not fixed.

---

### Finding ID: SEC-003
- **Title:** Unrestricted File Permissions on NASA Earthdata Credentials File (`_netrc`) in Windows Operating Systems
- **Severity:** Low
- **Confidence:** Confirmed
- **Affected file or endpoint:** `backend/app/core/config.py:124-126`
- **Evidence:** In `Settings.setup_netrc()`, POSIX file permission restriction `os.chmod(netrc_file, 0o600)` is explicitly bypassed on Windows platforms:
  ```python
  if not sys.platform.startswith("win") and netrc_file.exists():
      os.chmod(netrc_file, 0o600)
  ```
  On Windows file systems, `os.chmod` only controls the read-only attribute and cannot adjust DACLs. As a result, the newly generated `~/_netrc` file retains default inherited user/group permissions (e.g., `Users: Read`), potentially permitting other unprivileged local users or processes on the same machine to read stored NASA Earthdata credentials.
- **Attack preconditions:** Local user access or a compromised secondary process on the same Windows host.
- **Potential impact:** Disclosure of NASA Earthdata username and password to other local accounts on a multi-user Windows workstation.
- **Reproduction:** Call `settings.setup_netrc()` on a Windows host and inspect DACL permissions via `icacls %USERPROFILE%\_netrc`.
- **Evidence limitations:** Only applies when Earthdata credentials are provided via environment variables on Windows workstations; does not affect Linux/macOS/containerized deployments.
- **Recommended remediation direction:** In Windows environments, invoke `icacls` via subprocess to remove inherited permissions and grant explicit access only to the current user SID (`icacls <file> /inheritance:r /grant:r %USERNAME%:F`).
- **Status:** Open — not fixed.

---

### Finding ID: SEC-004
- **Title:** Parameter Injection in Download Filename via Unsanitized `variable_name` in Custom Dataset Export
- **Severity:** Low
- **Confidence:** Confirmed
- **Affected file or endpoint:** `GET /analysis/{analysis_id}/export/netcdf`, `GET /analysis/{analysis_id}/export/geojson`, `GET /analysis/{analysis_id}/dossier`, `backend/app/api/endpoints.py:1004-1015, 1050-1057, 1089-1096`
- **Evidence:** In `run_custom_analysis`, `req.variable_name` is converted to a slug via `var_slug = req.variable_name.lower().replace(" ", "_")`. However, double quotes (`"`), carriage returns (`\r`), newlines (`\n`), and special characters are not stripped. When downloading exports, the filename is interpolated into the HTTP header:
  ```python
  filename = f"earthsift_{req.variable_id}_{req.start_year}_{req.end_year}.nc"
  headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
  ```
  If a user inputs `variable_name = 'temp"; dummy=".nc'`, the double quote escapes the filename attribute in the `Content-Disposition` header.
- **Attack preconditions:** Submission of a custom dataset analysis with a crafted `variable_name` containing quotation marks.
- **Potential impact:** Filename parameter spoofing in user browser download dialogs; potential response header anomaly depending on client parser.
- **Reproduction:** Create a custom analysis with `variable_name = 'test"injection'`, then request `/analysis/{analysis_id}/export/geojson` and inspect the returned `Content-Disposition` header.
- **Evidence limitations:** Modern ASGI servers (Uvicorn / Starlette) strip carriage return/newline characters, preventing full HTTP response splitting; impact is restricted to filename escaping.
- **Recommended remediation direction:** Sanitize `var_slug` using a strict alphanumeric and underscore whitelist regex: `re.sub(r'[^a-zA-Z0-9_\-]', '', var_name)`.
- **Status:** Open — not fixed.

---

### Finding ID: SEC-005
- **Title:** Absence of Explicit `Cache-Control: no-store` Directives on User Analysis and Telemetry Endpoints
- **Severity:** Informational
- **Confidence:** Confirmed
- **Affected file or endpoint:** `backend/app/api/endpoints.py`, `backend/app/main.py:135-145`
- **Evidence:** While `SecurityHardeningMiddleware` injects strict OWASP ASVS headers (`X-Frame-Options`, `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`), it does not define an explicit `Cache-Control` header on API responses (`/analysis`, `/variables`, `/metrics`, `/auth/status`). Consequently, intermediary corporate HTTP proxies or shared browser caches may store analytical responses or user dataset payloads.
- **Attack preconditions:** User accessing the API through a shared intermediate caching proxy.
- **Potential impact:** Caching of custom uploaded datasets or telemetry metrics on intermediate proxy servers.
- **Reproduction:** Perform a GET request to `/ready` or POST to `/analysis` and inspect HTTP response headers for `Cache-Control`.
- **Evidence limitations:** Does not expose secrets, but represents a defense-in-depth privacy gap.
- **Recommended remediation direction:** Inject `Cache-Control: no-store, no-cache, must-revalidate, private` on all `/api/*` and dynamic analytical endpoints.
- **Status:** Open — not fixed.

---

### Finding ID: SEC-006
- **Title:** Hardcoded `reload=True` Development Configuration in Direct Module Execution Entry Point
- **Severity:** Informational
- **Confidence:** Confirmed
- **Affected file or endpoint:** `backend/app/main.py:341`
- **Evidence:** In the standalone module entry block:
  ```python
  if __name__ == "__main__":
      import uvicorn
      bind_host = os.getenv("HOST", "127.0.0.1")
      uvicorn.run("app.main:app", host=bind_host, port=8000, reload=True)
  ```
  `reload=True` is permanently enabled regardless of `ENVIRONMENT` setting. If an operator launches the service via `python app/main.py` rather than through an external ASGI runner (e.g., `uvicorn app.main:app --workers 4`), file-watching overhead and auto-reload capabilities remain active.
- **Attack preconditions:** Direct execution of `python app/main.py` in a production environment.
- **Potential impact:** Increased CPU/disk watcher consumption; accidental application restart upon file timestamp modification.
- **Reproduction:** Inspect lines 338-342 of `backend/app/main.py`.
- **Evidence limitations:** In standard containerized / production deployments, Uvicorn is invoked via CLI without triggering `__main__`.
- **Recommended remediation direction:** Gate `reload` parameter behind an environment flag: `reload=(os.getenv("ENVIRONMENT") != "production")`.
- **Status:** Open — not fixed.

---

## Security Verification Summary & Limitations

1. **Injection Attacks (SQLi, CMDi, SSTI):** PASSED. SQLite queries are strictly parameterized; natural language query parsing uses static dictionary and regex matchers; no `eval()`, `exec()`, or shell commands are invoked on user input.
2. **Path Traversal:** PASSED. NetCDF export utilizes `tempfile.TemporaryDirectory()` with auto-cleanup; static SPA serving validates path containment using `candidate.is_relative_to(dist_root)`.
3. **Secret Leakage:** PASSED. `SensitiveDataScrubber` actively intercepts and redacts NASA Earthdata credentials, Bearer tokens, and cryptographic keys from all log handlers and tracebacks.
4. **Denial of Service (DoS):** PARTIALLY HARDENED. Global payload size limits (2 MB) and SlowAPI rate limiting (10–60 req/min) are active; however, coordinate cell arrays in custom analysis require explicit array length boundaries (SEC-001).
5. **Phase Boundary Compliance:** Strictly observed. In accordance with Section 3.3 and Phase 9, no patches or code edits were applied during this assessment. All six findings remain Open.
