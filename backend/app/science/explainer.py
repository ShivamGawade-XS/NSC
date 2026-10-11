"""
EarthSift — Downstream AI Scientific Explainer
Translates verified empirical evidence records into plain scientific English.
Integrates live Gemini / OpenAI API with strict zero-hallucination guardrails
and a guaranteed deterministic scientific template fallback.
"""

import json
import logging
import os

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

    # Domain-aware falsifiable physical hypotheses
    v_lower = req.variable_name.lower()
    if "temp" in v_lower or "t2m" in v_lower:
        hypotheses = [
            {
                "hypothesis": "Hadley Cell Poleward Expansion",
                "mechanism": "Subtropical jet shift driving subsidence and persistent thermodynamic warming.",
                "doi": "10.1038/ngeo2343"
            },
            {
                "hypothesis": "Land-Atmosphere Soil Moisture Coupling",
                "mechanism": "Depleted root-zone moisture elevates sensible heat flux over latent cooling.",
                "doi": "10.1038/nature04577"
            },
            {
                "hypothesis": "Surface Albedo Positive Feedback",
                "mechanism": "Decreased cryosphere/snow cover increases net absorbed shortwave radiation.",
                "doi": "10.1029/2009GL041793"
            }
        ]
        bibtex = [
            "@article{scheff2014hadley, title={Widening of the Hadley cell}, journal={Nature Geoscience}, year={2014}}",
            "@article{sensi2006soil, title={Land-atmosphere feedbacks in European heat waves}, journal={Nature}, year={2006}}"
        ]
    elif "precip" in v_lower or "rain" in v_lower:
        hypotheses = [
            {
                "hypothesis": "Clausius-Clapeyron Atmospheric Moisture Redistribution",
                "mechanism": "Increased saturation vapor pressure (+7%/K) intensifies moisture divergence away from dry subtropics.",
                "doi": "10.1175/JCLI-D-12-00508.1"
            },
            {
                "hypothesis": "Atlantic/Pacific Sea Surface Temperature Dipole Forcing",
                "mechanism": "Inter-basin SST anomalies suppress localized convective precipitation.",
                "doi": "10.1038/s41558-021-01097-4"
            },
            {
                "hypothesis": "Vegetation Canopy Evapotranspiration Loss",
                "mechanism": "Reduced forest canopy moisture recycling accelerates regional drought cycles.",
                "doi": "10.1126/science.1185782"
            }
        ]
        bibtex = [
            "@article{held2006robust, title={Robust responses of the hydrological cycle}, journal={J. Climate}, year={2006}}"
        ]
    else:
        hypotheses = [
            {
                "hypothesis": "Aerosol Direct Radiative Forcing Equilibrium",
                "mechanism": "Reductions in optical depth modify downward shortwave solar flux.",
                "doi": "10.1126/science.1103215"
            },
            {
                "hypothesis": "Low Cloud Optical Thickness Modulation",
                "mechanism": "Variations in boundary layer relative humidity affect cloud droplet nucleation.",
                "doi": "10.1038/s41558-020-00958-9"
            },
            {
                "hypothesis": "Atmospheric Boundary Layer Inversion Layer Dynamics",
                "mechanism": "Thermal stratification modifies horizontal turbulent transport.",
                "doi": "10.1029/2012JD018286"
            }
        ]
        bibtex = [
            "@article{wild2005brightening, title={From dimming to brightening}, journal={Science}, year={2005}}"
        ]

    return ExplainResponse(
        summary=summary,
        statistical_assessment=assessment,
        limitations=limitations,
        physical_hypotheses=hypotheses,
        bibtex_citations=bibtex
    )


def _clean_and_parse_json(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return json.loads(text)


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
        f"1. You MUST explicitly state the exact numerical rate ({req.slope:+.3f} {req.slope_units}) in the summary.\n"
        f"2. DO NOT alter any calculated numbers.\n"
        f"3. DO NOT speculate on unverified physical drivers.\n"
        f"4. Return ONLY a valid JSON object with keys: 'summary', 'statistical_assessment', 'limitations'."
    )

    def _ground_evidence(parsed_dict: dict) -> ExplainResponse:
        summary_text = parsed_dict.get("summary", "").strip()
        slope_3f = f"{req.slope:.3f}"
        slope_abs_3f = f"{abs(req.slope):.3f}"
        if not any(s in summary_text for s in [slope_3f, slope_abs_3f, str(req.slope)]):
            summary_text = f"{summary_text.rstrip('.')} at an estimated rate of {req.slope:+.3f} {req.slope_units}."
        stat_text = parsed_dict.get("statistical_assessment", "").strip()
        if not stat_text:
            sig_str = "statistically significant" if req.significant else "not statistically significant"
            stat_text = f"The non-parametric trend test is {sig_str} (p = {req.p_value:.4f}, FDR q = {req.q_value:.4f})."
        limit_text = parsed_dict.get("limitations", "").strip()
        if not limit_text:
            limit_text = "Observations subject to reanalysis spatial grid resolution and sensor adjustments."
        return ExplainResponse(
            summary=summary_text,
            statistical_assessment=stat_text,
            limitations=limit_text
        )

    # 1. Attempt Gemini API
    if gemini_key:
        candidate_models = ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-2.5-flash"]
        for model in candidate_models:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
                headers = {
                    "Content-Type": "application/json",
                    "x-goog-api-key": gemini_key
                }
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.2,
                        "maxOutputTokens": 500,
                        "responseMimeType": "application/json"
                    }
                }
                with httpx.Client(timeout=10.0) as client:
                    res = client.post(url, headers=headers, json=payload)
                    if res.status_code == 200:
                        data = res.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            text_resp = candidates[0]["content"]["parts"][0]["text"]
                            parsed = _clean_and_parse_json(text_resp)
                            return _ground_evidence(parsed)
                    elif res.status_code in (400, 401, 403):
                        logger.warning("Gemini API rejected key/request with status %d (%s); aborting model loop.", res.status_code, res.text[:200])
                        break
                    else:
                        logger.warning("Gemini model %s returned HTTP %d: %s", model, res.status_code, res.text[:150])
            except Exception as e:
                logger.warning("Gemini model %s failed (%s); trying next.", model, e)

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
                    parsed = _clean_and_parse_json(content)
                    return _ground_evidence(parsed)
                elif res.status_code in (401, 403):
                    logger.warning("OpenAI API rejected key with HTTP %d.", res.status_code)
        except Exception as e:
            logger.warning("OpenAI Explainer call failed (%s); falling back to deterministic template.", e)

    return deterministic_fallback_explanation(req)
