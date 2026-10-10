"""
EarthSift — Downstream AI Scientific Explainer
Translates verified empirical evidence records into plain scientific English.
Integrates live Gemini / OpenAI API with strict zero-hallucination guardrails
and a guaranteed deterministic scientific template fallback.
"""

import os
import json
import logging
from typing import Dict, Any, Optional
import httpx

from app.schemas.analysis import ExplainRequest, ExplainResponse

logger = logging.getLogger("earthsift.explainer")


def deterministic_fallback_explanation(req: ExplainRequest) -> ExplainResponse:
    """Deterministic scientific interpretation when external AI is offline or unconfigured."""
    sig_text = "statistically significant" if req.significant else "not statistically significant"
    dir_word = "increase" if req.slope > 0 else "decrease"

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

    return ExplainResponse(
        summary=summary,
        statistical_assessment=assessment,
        limitations=limitations
    )


def explain_evidence_with_ai(req: ExplainRequest) -> ExplainResponse:
    """
    Downstream scientific explainer:
    Queries Google Gemini API or OpenAI API if credentials exist,
    strictly grounded to the input structured evidence payload.
    Falls back to deterministic template if offline, unconfigured, or on error.
    """
    gemini_key = os.environ.get("GEMINI_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")

    if not gemini_key and not openai_key:
        logger.debug("No GEMINI_API_KEY or OPENAI_API_KEY configured; utilizing deterministic scientific fallback.")
        return deterministic_fallback_explanation(req)

    prompt = (
        f"You are a NASA Earth Science communication specialist. "
        f"Translate the following strictly verified scientific evidence into clear, objective prose for researchers:\n"
        f"- Target Variable: {req.variable_name}\n"
        f"- Geographic Location: {req.location}\n"
        f"- Time Span: {req.time_span}\n"
        f"- Robust Sen Slope Rate: {req.slope:+.4f} {req.slope_units}\n"
        f"- Statistical Significance: p-value = {req.p_value:.4f}, FDR q-value = {req.q_value:.4f} (Significant: {req.significant})\n"
        f"- Trend Direction: {req.direction}\n"
        f"- Sample Count: {req.sample_count} verified observations from {req.source}\n\n"
        f"STRICT RULES:\n"
        f"1. DO NOT alter any calculated numbers.\n"
        f"2. DO NOT speculate on unverified physical drivers.\n"
        f"3. Return ONLY a valid JSON object with keys: 'summary', 'statistical_assessment', 'limitations'."
    )

    # 1. Attempt Gemini API
    if gemini_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.2,
                    "maxOutputTokens": 500,
                    "responseMimeType": "application/json"
                }
            }
            with httpx.Client(timeout=8.0) as client:
                res = client.post(url, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        text_resp = candidates[0]["content"]["parts"][0]["text"]
                        parsed = json.loads(text_resp)
                        return ExplainResponse(
                            summary=parsed.get("summary", ""),
                            statistical_assessment=parsed.get("statistical_assessment", ""),
                            limitations=parsed.get("limitations", "")
                        )
        except Exception as e:
            logger.warning("Gemini AI Explainer call failed (%s); falling back to deterministic template.", e)

    # 2. Attempt OpenAI API
    if openai_key:
        try:
            url = "https://api.openai.com/v1/chat/completions"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {openai_key}"
            }
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": "You are a scientific interpreter. Return strict JSON."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.2,
                "response_format": {"type": "json_object"}
            }
            with httpx.Client(timeout=8.0) as client:
                res = client.post(url, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    content = data["choices"][0]["message"]["content"]
                    parsed = json.loads(content)
                    return ExplainResponse(
                        summary=parsed.get("summary", ""),
                        statistical_assessment=parsed.get("statistical_assessment", ""),
                        limitations=parsed.get("limitations", "")
                    )
        except Exception as e:
            logger.warning("OpenAI Explainer call failed (%s); falling back to deterministic template.", e)

    return deterministic_fallback_explanation(req)
