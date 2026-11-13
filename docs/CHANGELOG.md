# Tellura — Project Changelog

All notable changes to the Tellura platform are documented in this file.
The project adheres to Semantic Versioning and rigorous engineering verification.

---

## [1.5.0] - 2026-11-13 — Performance & Scientific Feature Enhancements

### Added
- **FastAPI GZip Middleware:** Automatic wire compression for responses exceeding 1KB, shrinking large spatial grid payloads by 80–90%.
- **Ed Hawkins Climate Warming Stripes:** Interactive 1-click toggle in the Time Series card to render annual anomalies as color-coded climate stripes with Pettitt (1979) regime changepoints.
- **High-Resolution Publication Figure Export:** 1-click export of 2x retina figures (PNG) featuring coordinate stamps, Sen's rate, Kendall's $\tau$, Hamed-Rao $p$-value, and official NASA CF-1.8 attribution watermarks.
- **Dynamic Confidence Interval Selector:** Instant client-side switching between 90% ($Z=1.645$), 95% ($Z=1.960$), and 99% ($Z=2.576$) Gilbert (1987) confidence bands.
- **Decadal Extremes & Tail Acceleration Tracker:** Quantitative diagnostic in the Evidence Panel calculating the frequency of $\ge 1.5\sigma$ extreme anomaly years grouped by decade.
- **Expanded Workstation Hotkeys:** Added `A` (Toggle Anomaly Mode), `Space` (Play/Pause 4D Timeline), and `1`–`4` (Instant Exemplar Preset switching: Texas Basin, SW Transect, CONUS, Midwest Ag).
- **Startup Preset Pre-Warming:** Asynchronous background task during FastAPI lifespan to pre-warm the SQLite cache with baseline exemplar transects.

---

## [1.4.0] - 2026-11-13 — Scientific Integrity & Audit Remediation

### Fixed
- **S2 — Fabricated DOI removed.** Replaced `10.5067/Tellura-SPATIAL-2026.1` (prefix reserved for NASA data centers) with a proper `@software` citation via GitHub URL.
- **S1 — Attribution reworded.** "Extreme Event Attribution Engine" renamed to "Empirical Event Probability Shift (FAR Heuristic)" with scientific caveats that GCM ensembles are required for true climate attribution.
- **S3 — Overclaiming corrected.** "Global Nominee 2026" badge → "Challenge 2026"; "Peer-Reviewed" → "Non-Parametric Mathematical Architecture (Peer-Reviewed Statistical Formulations)"; "NASA Technical Memorandum" → "Tellura Climate Analytics Technical Memorandum".
- **S4 — Discovery ranking weights.** Non-FDR-significant cells reduced from weight 0.5/0.1 to 0.2/0.01, so FDR-significant cells now dominate rankings.
- **X1 — SECRET_KEY production guard.** Short explicit keys crash; missing keys produce fallback token with security warning (enables `docker compose up` for evaluators without `.env`); `STRICT_PRODUCTION_SECRETS=true` enforces crash on missing key.
- **X5 — `--forwarded-allow-ips "*"`** added to Dockerfile CMD for correct client IP behind reverse proxy.
- **X6 — CRLF header injection defense** in contact mailer; STARTTLS documentation corrected.
- **D2 — Docker Compose `env_file`** wiring for all credential variables.
- **D3 — Inbox path** moved under writable `/app/cache/inbox` mount with `TELLURA_INBOX_DIR` env var.
- **D4 — README run steps** corrected (pytest path, unified port `:8000`, dev server `--host 127.0.0.1`).
- **D5 — `EARTHSIFT_DB_PATH` → `TELLURA_DB_PATH`** unified across Dockerfile and code.
- **D6 — Python version** unified to 3.12 across README, SECURITY.md, and Dockerfile.
- **Test suite updated** to reflect renamed titles, metric prefixes, and security key behavior (338/338 passing).

### Changed
- Prometheus metric namespace: `earthsift_` → `tellura_` across all counters, histograms, and gauges.
- LaTeX export title: "NASA Technical Memorandum" → "Tellura Climate Analytics Technical Memorandum".
- Dossier title: "NASA Earth Science Briefing" → "Tellura Earth Science Briefing".
- Explainer author: "Tellura Automated Scientific Intelligence Engine" → "Tellura Spatiotemporal Discovery Engine".

### Documentation
- **SECURITY.md** expanded: added NLQ copilot, CRLF injection, LaTeX injection, GeoJSON upload, LLM data sharing, and metrics access control to threat model; year bounds updated to 2026; Python version unified to 3.12.
- **METHODOLOGY.md** overhauled: added Var(S) formula with tie corrections, H&R lag cap, Pettitt §7 with methodological caveat, LISA §8 with multiplicity note, updated discovery weights.
- **ARCHITECTURE.md** refined: zero-synthetic guarantee scoped, metrics access documented, explainer wording improved.

---

## [1.3.0] - 2026-11-13 — UX & Export Polish

### Added
- Live bounding box quota calculator with NASA POWER 100 deg² limit visualization.
- Stepwise loading telemetry showing grid cell count and estimated fetch time.
- Mobile view switcher (Map / Chart / Evidence) for tablet/phone screens.
- Literature engine badge showing active AI explainer tier.
- 6 Google Colab reproducibility notebooks.

### Fixed
- AudioContext autoplay policy guard.
- Form field accessibility — all inputs have proper `id` and `name` attributes.
- Tailwind v4 dark mode `@custom-variant` compatibility.
- Dark/light mode typography overhaul: eliminated neon accent colors, improved WCAG contrast ratios.

---

## [1.2.0] - 2026-11-12 — Security Hardening & Brand Identity

### Added
- Pagination support for signals discovery endpoint.
- Comprehensive Tellura project guide and architecture dossier.
- Modernized diagnostic labs and exploratory modals with unified design tokens.

### Fixed
- Eliminated fallback secret salt; hardened production CSP `connect-src`.
- Eliminated f-string SQL construction in `db_cache`; annotated safe NASA URL fetch.

---

## [1.0.0] - 2026-10-05 — NASA Space Apps Release

### Added
- **Scientific Computing Engine (`trend.py`):** Non-parametric Mann-Kendall test with Hamed & Rao (1998) autocorrelation correction, Sen's slope with Gilbert (1987) 95% CI, Benjamini-Hochberg FDR, and vectorized 3D spatial processing.
- **Dataset Adapter Layer:** Abstract `BaseDatasetAdapter` with NASA POWER live streaming and MERRA-2 reanalysis adapters via `earthaccess`.
- **Discovery Engine:** "Find Something Interesting" with composite scoring and 8-neighbor spatial coherence.
- **Contrast Engine:** Regional opposing trend pair discovery with causal caveats.
- **FastAPI API:** 15+ typed endpoints including analysis, export, attribution, and copilot.
- **Scientific Instrument UI:** 4-panel layout with Leaflet cartography, Chart.js time series, and evidence inspector.
- **Automated Test Suite:** 338 automated tests (100% passing).

---

## [0.2.0] - 2026-10-05 — Open-Source Research & Truth Ledger Audit
- Completed live CMR API query verification for `M2TMNXSLV`, `M2TMNXFLX`, and `M2TMNXLND`.
- Established `docs/TRUTH_LEDGER.md` with 13 verified facts and 2 recorded assumptions.

---

## [0.1.0] - 2026-10-05 — Initial Architecture & Skeleton
- Initialized FastAPI backend and static frontend.
- Created `README.md` and initial documentation outlines.
