# EarthSift — Service Level Objectives (SLOs) & Privacy Architecture

**Target System:** EarthSift Climate Science Engine  
**Standard Grounding:** Google SRE PRR, OWASP Privacy Risks, NIST Cybersecurity Framework  

---

## 1. Service Level Indicators (SLIs) & Objectives (SLOs)

| Service Target | Metric / SLI | Target SLO (Rolling 30-Day) | Error Budget |
|---|---|---|---|
| **API Availability** | Successful non-5xx requests across `/health`, `/ready`, `/analysis/*` | $\ge 99.9\%$ availability | $0.1\%$ (~43 minutes downtime/month) |
| **Health Probe Latency** | HTTP GET `/health` and `/ready` latency | $p95 < 20\text{ms}$, $p99 < 35\text{ms}$ | $< 0.1\%$ queries exceeding threshold |
| **Cached Analysis Retrieval** | HTTP GET `/analysis/{id}` | $p95 < 35\text{ms}$, $p99 < 60\text{ms}$ | $< 0.5\%$ queries exceeding threshold |
| **Primary Compute Latency** | HTTP POST `/analysis` (Bounding boxes $\le 2500$ cells) | $p95 < 500\text{ms}$, $p99 < 1200\text{ms}$ | $< 1.0\%$ queries exceeding threshold |
| **Data Integrity** | Cryptographic verification of HMAC-SHA256 cached analysis payloads | $100.0\%$ payload validation | $0.0\%$ tolerance for unsigned/tampered data |
| **Zero Synthetic Data** | Authenticity of observations returned across all supported datasets | $100.0\%$ verified observations (HTTP 503 if unavailable) | $0.0\%$ synthetic numbers in production exports |

---

## 2. Privacy & Data Handling Architecture

### 1. Zero Personal Identifiable Information (PII) Stored
EarthSift is a public Earth science observation analysis tool. It processes purely geophysical geospatial variables (temperatures, precipitation, solar radiation, wind speed).
- No user names, emails, physical addresses, or credentials are required or persisted.
- API keys provided in `X-API-Key` headers are hashed via SHA-256 before memory comparison; raw key text is never logged or written to SQLite.

### 2. IP Address & Telemetry Sanitization
- External IP addresses are captured exclusively in transient memory for rate-limiting bucket tracking (SlowAPI) and reverse proxy security headers.
- All application log formatters pass through `SensitiveDataScrubber`:
  - Strips API keys, passwords, bearer tokens, and netrc secrets matching regex patterns `(ai_key|api_key|token|bearer|secret|password)=...`
  - Replaces matches with `[REDACTED]`.

### 3. Untrusted Input Isolation
- Bounding box coordinates, start/end years, and variables are strictly validated using Pydantic schemas.
- Free-form user text parameters passed to downstream scientific narrative endpoints are sanitized using XML tag escaping (`<evidence_context>`) and regex filtering to reject prompt injection attacks.
