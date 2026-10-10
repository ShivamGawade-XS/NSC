# EarthSift — AI Usage Policy & Zero-Hallucination Guardrails

**Challenge:** NASA Space Apps 2026 — *Be An Earth System Trend Detective!*  
**Document:** `docs/AI_USAGE.md`  

---

## 1. Role of AI in EarthSift
In accordance with the Anti-Hallucination rules and scientific principles of EarthSift, **Artificial Intelligence is strictly downstream of the mathematical analysis engine**.

```
[NASA Reanalysis Data] 
       │
       ▼
[Mathematical Scientific Engine] ───► Calculates: Slope, p-value, q-value, τ
       │
       ▼
[Structured Evidence Object] ────────► Strict JSON Schema Contract
       │
       ▼
[Downstream AI Explainer] ───────────► Translates verified evidence to plain English
       │
       ▼
[Deterministic Offline Fallback] ────► Guaranteed resilience if model unavailable
```

---

## 2. Inviolable AI Guardrails
The language model is explicitly forbidden from:
1. **Calculating numbers:** All mathematical slopes, Kendall's tau values, variance estimates, and p-values are computed exclusively by NumPy and SciPy.
2. **Modifying numbers:** The AI cannot alter or round computed numbers beyond the structured evidence record.
3. **Speculating on unverified causes:** The AI cannot attribute trends to speculative physical drivers without evidence in the citation metadata.
4. **Converting p-values into probabilities:** A p-value of 0.01 is never described as "a 99% probability that global warming is true."
5. **Calling a trend a forecast:** The model is strictly prohibited from claiming that an empirical trend over 2000-2023 guarantees future continuation.
6. **Hiding scientific limitations:** Every output must explicitly summarize the caveats of empirical monotonic trend detection.

---

## 3. Deterministic Fallback Implementation
If an external AI provider (OpenAI, Anthropic, or Gemini) is unreachable, unconfigured, or returns an error, EarthSift utilizes a **deterministic template engine** (`backend/app/api/endpoints.py:explain_evidence`):

```python
summary = (
    f"At {req.location}, {req.variable_name} demonstrated a {dir_word} of "
    f"{req.slope:+.3f} {req.slope_units} across the period {req.time_span}."
)
assessment = (
    f"The Mann-Kendall test determined this change is {sig_text} "
    f"(p-value = {req.p_value:.4f}, FDR adjusted q-value = {req.q_value:.4f}) "
    f"across {req.sample_count} verified temporal observations from {req.source}."
)
limitations = (
    "Statistical significance confirms empirical persistence over the observed period, "
    "but does not identify physical forcing mechanisms or guarantee future extrapolation."
)
```

This guarantees 100% availability and zero hallucination risk during offline demonstrations and jury evaluation.
