# Tellura — Security Architecture & Threat Model

**Challenge:** NASA Space Apps 2026 — *Be An Earth System Trend Detective!*  
**Document:** `docs/SECURITY.md`  

---

## 1. Security Philosophy
Tellura is an evidence-first, open-science scientific instrument. Its security posture adheres to strict principle-of-least-privilege guidelines, zero-trust input validation, and total isolation of client-side code from sensitive credentials.

---

## 2. Threat Vector Mitigations

| Threat Vector | Potential Impact | Tellura Mitigation |
|---|---|---|
| **Credential Leakage** | Exposure of NASA Earthdata or AI API keys in client JavaScript bundles | **Strict Server-Side Boundary:** No credentials exist in client bundles. Earthdata auth is managed exclusively in backend environment variables (`EARTHDATA_USERNAME`, `EARTHDATA_PASSWORD`) or local `~/.netrc`. |
| **Arbitrary Code Execution** | Shell execution via malicious spatial or analysis parameters | **Zero Shell Execution:** No user input is ever passed to `eval()`, `exec()`, or subshell commands. All numerical execution occurs strictly via native Python/NumPy vectorized code. |
| **Path Traversal & Arbitrary File Access** | Access to host system files through dataset or analysis IDs | **Whitelist Dataset Identifiers:** Endpoints accept only registered dataset IDs (`merra2_reanalysis`). File paths are resolved using strict `Path.resolve()` anchors within project directories. |
| **Denial of Service (DoS) via Giant Slices** | Memory exhaustion by requesting a 100-year global 0.01° grid | **Strict Validation Bounds:** `start_year` and `end_year` are bounded (1980 ≤ year ≤ 2026), and spatial bounding boxes are clamped to NASA POWER's 100 deg² limit prior to array allocation. |
| **AI Prompt Injection** | Manipulation of downstream scientific explanation | **Structured Typed Payload:** AI inputs are strictly constrained to typed Pydantic models containing numerical rates and p-values. No raw, unvalidated user text is piped to the explainer. The NLQ copilot parser extracts structured spatial/temporal parameters only — free-form text never reaches the LLM system prompt. |
| **Cross-Origin Resource Sharing (CORS)** | Unauthorized cross-origin manipulation | Configured with explicit CORS middleware headers. |
| **Information Leakage via Logs** | Exposing sensitive tokens in server console logs | `SensitiveDataScrubber` logging filter redacts `SECRET_KEY`, `EARTHDATA_TOKEN`, `EARTHDATA_PASSWORD`, bearer tokens, and URL-embedded credentials from all log records, exception tracebacks, and structured args. |
| **CRLF Header Injection** | Manipulating email headers via contact form | Mailer sanitizes all user-supplied strings (name, email, topic) by stripping `\r` and `\n` characters before SMTP header construction. |
| **LaTeX Injection** | Arbitrary commands via exported LaTeX documents | All dynamic strings in LaTeX exports pass through `_escape_latex()` which escapes `\`, `{`, `}`, `$`, `&`, `#`, `^`, `_`, `~`, `%`, and backtick characters. |
| **GeoJSON Upload** | Oversized or malformed geometry payloads | Custom analysis endpoint validates GeoJSON structure and enforces coordinate bounds before processing. |
| **LLM Data Sharing** | User analysis data sent to third-party LLM providers | AI synthesis sends only aggregated statistical summaries (trend rates, p-values, variable names) to LLM APIs — never raw observational data, coordinates, or personally identifiable information. A 200-request daily budget cap limits exposure. |

---

## 3. Metrics & Telemetry Access Control

The `/metrics` and `/metrics/prometheus` endpoints are protected by `require_metrics_access()`:
- **Internal listeners** (loopback/testclient): Full access without authentication.
- **External clients**: Require a valid `X-API-Key` header matching keys in `TELLURA_API_KEYS`.
- **Unauthorized external requests**: Receive 401/403.

---

## 4. Dependency Security Audit
- No dependencies with known critical CVEs at time of submission.
- Tested on Python 3.12 with pinned version floors and hash verification in `requirements.txt`.
- Client assets utilize SRI hashes when loading external Leaflet scripts from CDNs.
