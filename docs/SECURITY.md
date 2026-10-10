# EarthSift — Security Architecture & Threat Model

**Challenge:** NASA Space Apps 2026 — *Be An Earth System Trend Detective!*  
**Document:** `docs/SECURITY.md`  

---

## 1. Security Philosophy
EarthSift is an evidence-first, open-science scientific instrument. Its security posture adheres to strict principle-of-least-privilege guidelines, zero-trust input validation, and total isolation of client-side code from sensitive credentials.

---

## 2. Threat Vector Mitigations

| Threat Vector | Potential Impact | EarthSift Mitigation |
|---|---|---|
| **Credential Leakage** | Exposure of NASA Earthdata or AI API keys in client JavaScript bundles | **Strict Server-Side Boundary:** No credentials exist in client bundles. Earthdata auth is managed exclusively in backend environment variables (`EARTHDATA_USERNAME`, `EARTHDATA_PASSWORD`) or local `~/.netrc`. |
| **Arbitrary Code Execution** | Shell execution via malicious spatial or analysis parameters | **Zero Shell Execution:** No user input is ever passed to `eval()`, `exec()`, or subshell commands. All numerical execution occurs strictly via native Python/NumPy vectorized code. |
| **Path Traversal & Arbitrary File Access** | Access to host system files through dataset or analysis IDs | **Whitelist Dataset Identifiers:** Endpoints accept only registered dataset IDs (`merra2_reanalysis`). File paths are resolved using strict `Path.resolve()` anchors within project directories. |
| **Denial of Service (DoS) via Giant Slices** | Memory exhaustion by requesting a 100-year global 0.01° grid | **Strict Validation Bounds:** `start_year` and `end_year` are bounded ($1980 \le \text{year} \le 2024$), and spatial bounding boxes are clamped and validated prior to array allocation. |
| **AI Prompt Injection** | Manipulation of downstream scientific explanation | **Structured Typed Payload:** AI inputs are strictly constrained to typed Pydantic models containing numerical rates and p-values. No raw, unvalidated user text is piped to the explainer. |
| **Cross-Origin Resource Sharing (CORS)** | Unauthorized cross-origin manipulation | Configured with explicit CORS middleware headers. |
| **Information Leakage via Logs** | Exposing sensitive tokens in server console logs | Logging configuration strips credentials and sanitizes query parameters. |

---

## 3. Dependency Security Audit
- No dependencies with known critical CVEs.
- Tested on standard Python 3.13 / 3.14 with pinned version floors in `requirements.txt`.
- Client assets utilize SRI hashes when loading external Leaflet scripts from CDNs.
