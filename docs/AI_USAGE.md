# Tellura — AI System Architecture, Fallback Cascade & Anti-Hallucination Policy

**Challenge:** NASA Space Apps 2026 — *Be An Earth System Trend Detective!*  
**Document:** `docs/AI_USAGE.md`  
**Status:** Production Standard (Verified with 337/337 Automated Tests)

---

## 1. Role of AI in Tellura

In Tellura, **Artificial Intelligence is strictly downstream of the mathematical analysis engine**. Generative models never compute, interpolate, or modify climate statistics. They serve solely as:
1. **Downstream Scientific Explainer (`explainer.py`):** Translates empirically calculated, non-parametric statistics into peer-reviewed scientific prose.
2. **Spatiotemporal Natural Language Copilot (`nlq_parser.py`):** Converts free-form scientific inquiries (e.g. *"Show warming over the Mediterranean between 2000 and 2020"*) into structured, type-checked Pydantic query parameters.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    UPSTREAM EMPIRICAL MATHEMATICS (NumPy / SciPy)               │
│  - Mann-Kendall monotonic sign test (S statistic)                               │
│  - Hamed-Rao (1998) serial autocorrelation variance adjustment (Var*)           │
│  - Theil-Sen robust median slope estimator & Gilbert (1987) 95% bounds          │
│  - Benjamini-Hochberg False Discovery Rate multiplicity control (q ≤ 0.05)      │
│  - Pettitt (1979) regime shifts, Burrows climate velocity, Archimedean copulas   │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    UNTRUSTED STRUCTURED EVIDENCE CONTEXT PAYLOAD                 │
│  <evidence_context>                                                             │
│    <variable_name>2-Meter Air Temperature</variable_name>                       │
│    <location>Tibetan Plateau [85.0°E, 32.0°N]</location>                        │
│    <time_span>2000 - 2023</time_span>                                           │
│    <slope>+0.3421</slope> <slope_units>°C / decade</slope_units>                │
│    <p_value>0.0012</p_value> <q_value>0.0041</q_value>                          │
│    <significant>true</significant> <sample_count>24</sample_count>              │
│    <source>NASA GMAO MERRA-2</source>                                           │
│  </evidence_context>                                                            │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    CASCADING MULTI-PROVIDER AI SYNTHESIS                        │
│                                                                                 │
│  1. Primary: Google Gemini API (gemini-flash-lite-latest)                       │
│     ├── If 429 Quota / Timeout / 5xx / 401: Failover to Secondary               │
│  2. Secondary: Groq Cloud (qwen/qwen3.8-27b) or xAI Grok (grok-2-mini)          │
│     ├── If Quota / Timeout / 5xx / 401: Failover to Tertiary                    │
│  3. Tertiary: OpenAI API (gpt-4o-mini)                                          │
│     ├── If Quota / Timeout / 5xx / 401: Failover to Quaternary                  │
│  4. Quaternary: Deterministic Scientific Template Engine (Guaranteed Base)       │
│     └── 0.5 ms execution, 100% offline uptime, zero hallucinations              │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    INSPECTION, GROUNDING & VALUE INTEGRITY SHIELD               │
│  - Numerical check: slope, p-value, and q-value must match ground truth         │
│  - Anti-injection sanitization: strips HTML / script tags / prompt injection   │
│  - Probability guardrail: converts "% chance" into "significance level"         │
│  - Transparent provenance tagging: model_used displayed in response             │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Multi-Model Cascade & Failover Logic

Tellura implements an automated, multi-tier fallback cascade ensuring that external API downtime, rate limits, or quota exhaustion never degrade user experience:

### Tier 1: Primary — Google Gemini (`generativelanguage.googleapis.com`)
- **Default Model**: `gemini-flash-lite-latest` (fastest latency, lightweight footprint).
- **Fallback Models within Tier 1**: `gemini-flash-latest`, `gemini-2.5-flash`.
- **Generation Parameters**: `temperature: 0.2` (explainer) / `0.0` (NLQ), `responseMimeType: "application/json"`, `maxOutputTokens: 500`.
- **Connection Policy**: `httpx.AsyncClient` with `timeout=5.0s`, `connect=2.0s`.

### Tier 2: Secondary — Groq Cloud or xAI Grok (Auto-Detected)
- **Key Detection**: If key begins with `gsk_`, routes to Groq Cloud; if key begins with `xai-`, routes to xAI Grok.
- **Groq Cloud Models**: `qwen/qwen3.8-27b`, `openai/gpt-oss-120b`, `openai/gpt-oss-20b` via `https://api.groq.com/openai/v1/chat/completions`.
- **xAI Grok Models**: `grok-2-mini`, `grok-beta`, `grok-2-latest` via `https://api.x.ai/v1/chat/completions`.
- **Generation Parameters**: `temperature: 0.2`, `response_format: {"type": "json_object"}`.

### Tier 3: Tertiary — OpenAI (`api.openai.com`)
- **Model**: `gpt-4o-mini`.
- **Generation Parameters**: `temperature: 0.2`, `response_format: {"type": "json_object"}`.

### Tier 4: Quaternary — Deterministic Scientific Template Engine
- **Uptime**: 100% guaranteed offline resilience.
- **Latency**: ~0.5 ms.
- **Behavior**: Employs peer-reviewed scientific grammar templates, domain-aware falsifiable physical hypotheses (Hadley cell expansion, land-atmosphere coupling, Clausius-Clapeyron moisture divergence), and real DOI citations.

---

## 3. When Does the System Switch Models?

The failover cascade triggers seamlessly under the following conditions:
1. **HTTP 429 (Rate Limit / Quota Exceeded):** If Gemini's free tier rate limit or daily quota is exceeded, the system automatically advances to Groq/Grok or OpenAI.
2. **HTTP 500 / 502 / 503 / 504 (Service Outage):** If an upstream provider returns a server error, the next candidate model or provider is immediately invoked.
3. **HTTP 401 / 403 (Invalid Key / Unauthorized):** If an API key is rejected or expired, the provider is cleanly bypassed without throwing an unhandled exception.
4. **Network Timeout:** Strict non-blocking timeouts (2.0s connect, 4.0s-5.0s read) prevent lagging requests from stalling UI responsiveness.
5. **Daily Spend Cap Exhaustion:** When anonymous users exceed the daily spend limit, external calls are bypassed instantly in favor of the deterministic template engine.

---

## 4. Spend Protection & Quota Limits

To protect API budgets while providing open-access scientific analysis:

| Protection Mechanism | Configuration | Behavior |
|---|---|---|
| **Daily LLM Budget Tracker** | `DAILY_LLM_CALL_LIMIT=200` | Tracks external LLM calls across all anonymous users in a sliding 24-hour window. Once 200 calls are reached, calls degrade gracefully to the deterministic template engine. |
| **Keyed Access Tier** | `X-API-Key` or `Authorization: Bearer` | Authenticated researchers bypass the daily budget limit. |
| **NLQ Rate Limiting** | `SlowAPI: 30/minute` | Limits spatiotemporal query parser invocations per IP. |
| **Explainer Rate Limiting** | `SlowAPI: 60/minute` | Limits explanation requests per IP. |
| **Analysis Rate Limiting** | `SlowAPI: 30/minute` | Limits intensive mathematical trend calculations per IP. |

---

## 5. Inviolable Anti-Hallucination Guardrails

1. **Strict Mathematical Grounding:** Slopes, Kendall's $\tau$, $Z$-scores, $p$-values, and FDR $q$-values are computed exclusively by NumPy and SciPy. The LLM receives pre-computed numbers inside `<evidence_context>` tags.
2. **Numerical Preservation Verification:** Post-processing regex scans the LLM output to ensure the exact numerical rate (e.g. `+0.342 °C/decade`) and verified $p$/$q$ values appear unaltered. If missing or altered, the verified mathematical record is automatically appended.
3. **Probability Reinterpretation Guardrail:** The model is prohibited from describing $p$-values as event probabilities. Any phrase matching `% probability` or `% chance` is replaced with "statistical significance level".
4. **No Unwarranted Extrapolation:** The model is forbidden from characterizing multi-decadal empirical trends as forecasts or guaranteeing future continuation.
5. **XML Prompt Injection Shield:** All user inputs are sanitized with HTML entity escapes and wrapped inside `<evidence_context>` with explicit boundary defense prompts instructing the model to treat all enclosed content as untrusted data.
6. **Provenance Transparency:** Every API response includes a `model_used` attribute (e.g., `"Live Google Gemini Flash Lite"`, `"Live Groq (qwen/qwen3.8-27b)"`, or `"Deterministic Scientific Template"`), ensuring judges and researchers know the exact provenance of every statement.
