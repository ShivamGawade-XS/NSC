"""
Tellura — Natural Language Spatiotemporal Query Parser (NLQ)
Converts human natural language scientific queries into structured Pydantic AnalysisRequests.

Strategy:
  1. Fast deterministic regex/dict parse (always runs).
  2. If confidence is low (<0.70) AND GEMINI_API_KEY is set, upgrade with a Gemini
     JSON function-call that can resolve arbitrary place names, variable synonyms,
     and temporal phrases the regex misses.
  3. Falls back to the deterministic result on any LLM error (network, quota, parse).
"""

import json
import logging
import os
import re
from typing import Any

import httpx

from app.schemas.analysis import AnalysisRequest, NLQParseResponse

logger = logging.getLogger("earthsift.nlq_parser")

# ---------------------------------------------------------------------------
# Knowledge base
# ---------------------------------------------------------------------------

# Region bounding boxes [min_lon, min_lat, max_lon, max_lat]
# Sorted longest-key-first so more specific names win over substrings.
REGION_BBOX_MAP = dict(
    sorted(
        {
            "north america": [-130.0, 24.0, -65.0, 60.0],
            "united states": [-125.0, 25.0, -66.0, 49.0],
            "southern plains": [-102.0, 30.0, -94.0, 38.0],
            "colorado river": [-115.0, 31.0, -102.0, 42.0],
            "mediterranean": [-6.0, 30.0, 36.0, 46.0],
            "south america": [-82.0, -56.0, -34.0, 13.0],
            "california": [-124.5, 32.5, -114.1, 42.0],
            "antarctica": [-180.0, -90.0, 180.0, -60.0],
            "australia": [112.0, -44.0, 154.0, -10.0],
            "southwest": [-115.0, 31.0, -102.0, 42.0],
            "svalbard": [10.0, 76.0, 30.0, 81.0],
            "midwest": [-100.0, 36.0, -82.0, 48.0],
            "arctic": [-180.0, 66.0, 180.0, 85.0],
            "europe": [-10.0, 35.0, 35.0, 70.0],
            "amazon": [-75.0, -15.0, -45.0, 5.0],
            "africa": [-20.0, -35.0, 52.0, 37.0],
            "global": [-180.0, -85.0, 180.0, 85.0],
            "texas": [-106.6, 25.8, -93.5, 36.5],
            "conus": [-125.0, 25.0, -65.0, 50.0],
            "sahel": [-18.0, 10.0, 35.0, 18.0],
            "india": [68.0, 8.0, 97.0, 37.0],
            "china": [73.0, 18.0, 135.0, 53.0],
            "brazil": [-73.0, -33.0, -34.0, 5.0],
            "indonesia": [95.0, -11.0, 141.0, 6.0],
            "sahara": [-17.0, 15.0, 36.0, 37.0],
            "alaska": [-169.0, 54.0, -130.0, 72.0],
            "florida": [-87.6, 24.5, -80.0, 31.0],
            "asia": [60.0, 10.0, 145.0, 55.0],
            "usa": [-125.0, 25.0, -66.0, 49.0],
        }.items(),
        key=lambda item: len(item[0]),
        reverse=True,
    )
)

VARIABLE_MAP = {
    "temperature": "T2M",
    "warming": "T2M",
    "heat": "T2M",
    "thermal": "T2M",
    "t2m": "T2M",
    "precipitation": "PRECTOT",
    "rain": "PRECTOT",
    "rainfall": "PRECTOT",
    "drought": "PRECTOT",
    "pluvial": "PRECTOT",
    "prectot": "PRECTOT",
    "solar": "ALLSKY_SFC_SW_DWN",
    "radiation": "ALLSKY_SFC_SW_DWN",
    "insolation": "ALLSKY_SFC_SW_DWN",
    "sunlight": "ALLSKY_SFC_SW_DWN",
    "wind": "WS10M",
    "windspeed": "WS10M",
    "speed": "WS10M",
    "ws10m": "WS10M",
    "humidity": "RH2M",
    "moisture": "RH2M",
    "rh2m": "RH2M",
}

VALID_VARS = {"T2M", "PRECTOT", "ALLSKY_SFC_SW_DWN", "WS10M", "RH2M"}

# ---------------------------------------------------------------------------
# Deterministic parser
# ---------------------------------------------------------------------------

def _deterministic_parse(query: str) -> tuple[NLQParseResponse, float]:
    """Return (NLQParseResponse, confidence).  Confidence < 0.70 triggers LLM upgrade."""
    q_lower = query.lower()

    # 1. Variable
    matched_var = "T2M"
    for synonym, var_code in VARIABLE_MAP.items():
        if re.search(r"\b" + re.escape(synonym) + r"\b", q_lower):
            matched_var = var_code
            break

    # 2. Region
    matched_bbox: list[float] | None = None
    matched_regions: list[str] = []
    for region_name, bbox in REGION_BBOX_MAP.items():
        if re.search(r"\b" + re.escape(region_name) + r"\b", q_lower) or region_name in q_lower:
            matched_bbox = bbox
            matched_regions.append(region_name.title())
            break

    # 3. Year range
    start_year, end_year = 2000, 2023
    relative_match = re.search(r"(?:last|past)\s+(\d{1,2})\s+years?", q_lower)
    if relative_match:
        end_year = 2023
        start_year = max(1980, 2023 - int(relative_match.group(1)))
    else:
        between_match = re.search(r"(?:between|from)?\s*(\d{4})\s*(?:and|to|-)\s*(\d{4})", q_lower)
        if between_match:
            y1, y2 = int(between_match.group(1)), int(between_match.group(2))
            start_year = max(1980, min(2026, min(y1, y2)))
            end_year = max(1980, min(2026, max(y1, y2)))
        else:
            after_match = re.search(r"(?:after|since|from)\s*(\d{4})", q_lower)
            if after_match:
                y = int(after_match.group(1))
                start_year = max(1980, min(2025, y))
                end_year = 2023
            else:
                before_match = re.search(r"(?:before|until)\s*(\d{4})", q_lower)
                if before_match:
                    y = int(before_match.group(1))
                    end_year = max(1985, min(2026, y))
                    start_year = 1990

    if start_year >= end_year:
        start_year = max(1980, end_year - 15)

    # 4. Alpha
    alpha = 0.05
    if "high confidence" in q_lower or "strict" in q_lower or "p < 0.01" in q_lower:
        alpha = 0.01
    elif "exploratory" in q_lower or "relaxed" in q_lower or "alpha 0.1" in q_lower:
        alpha = 0.10

    dataset_id = "nasa_power" if matched_var in ("ALLSKY_SFC_SW_DWN", "WS10M", "RH2M") else "merra2_reanalysis"
    analysis_req = AnalysisRequest(
        dataset_id=dataset_id,
        variable_id=matched_var,
        start_year=start_year,
        end_year=end_year,
        bbox=matched_bbox,
        alpha=alpha,
        prefer_live=True,
        use_fdr=True,
    )

    region_desc = f"in {', '.join(matched_regions)}" if matched_regions else "across global domain"
    intent_desc = (
        f"Detected request for {matched_var} trends {region_desc} from {start_year} to {end_year} "
        f"with significance threshold alpha={alpha}."
    )

    # Confidence: lower when region not matched or only default variable used
    confidence = 0.95 if (matched_bbox and matched_var != "T2M") else (0.80 if matched_bbox else 0.60)

    return NLQParseResponse(
        raw_query=query,
        interpreted_intent=intent_desc,
        analysis_request=analysis_req,
        confidence=confidence,
        matched_regions=matched_regions,
    ), confidence


# ---------------------------------------------------------------------------
# Gemini semantic upgrade
# ---------------------------------------------------------------------------

_GEMINI_NLQ_PROMPT = """\
You are a geospatial climate-science query parser.
Given a natural-language query, extract these fields as JSON:
{
  "variable_id": "<one of T2M|PRECTOT|ALLSKY_SFC_SW_DWN|WS10M|RH2M>",
  "bbox": [min_lon, min_lat, max_lon, max_lat] or null,
  "region_name": "<human readable region name or null>",
  "start_year": <integer 1980-2026>,
  "end_year": <integer 1980-2026>,
  "alpha": <0.01|0.05|0.10>,
  "dataset_id": "<nasa_power|merra2_reanalysis>"
}
Rules:
- dataset_id is "nasa_power" if variable_id is ALLSKY_SFC_SW_DWN, WS10M, or RH2M; else "merra2_reanalysis".
- If the region is unknown, set bbox to null.
- Output ONLY the JSON object, no markdown, no explanation.

Query: """


def _build_upgraded_response(query: str, parsed: dict[str, Any]) -> NLQParseResponse:
    var_id = parsed.get("variable_id", "T2M")
    if var_id not in VALID_VARS:
        var_id = "T2M"
    bbox = parsed.get("bbox")
    if bbox and (not isinstance(bbox, list) or len(bbox) != 4):
        bbox = None
    start_year = max(1980, min(2026, int(parsed.get("start_year", 2000))))
    end_year = max(1980, min(2026, int(parsed.get("end_year", 2023))))
    if start_year >= end_year:
        start_year = max(1980, end_year - 15)
    alpha = float(parsed.get("alpha", 0.05))
    if alpha not in (0.01, 0.05, 0.10):
        alpha = 0.05
    dataset_id = parsed.get("dataset_id", "merra2_reanalysis")
    if dataset_id not in ("nasa_power", "merra2_reanalysis"):
        dataset_id = "merra2_reanalysis"
    region_name = parsed.get("region_name") or ""
    matched_regions = [region_name] if region_name else []

    analysis_req = AnalysisRequest(
        dataset_id=dataset_id,
        variable_id=var_id,
        start_year=start_year,
        end_year=end_year,
        bbox=bbox,
        alpha=alpha,
        prefer_live=True,
        use_fdr=True,
    )
    region_desc = f"in {region_name}" if region_name else "across global domain"
    intent_desc = (
        f"[Gemini-parsed] {var_id} trends {region_desc} "
        f"from {start_year} to {end_year}, alpha={alpha}."
    )
    return NLQParseResponse(
        raw_query=query,
        interpreted_intent=intent_desc,
        analysis_request=analysis_req,
        confidence=0.92,
        matched_regions=matched_regions,
    )


async def _gemini_upgrade_async(query: str, fallback: NLQParseResponse) -> NLQParseResponse:
    """Asynchronous Gemini semantic parser with non-blocking network calls."""
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    if not gemini_key:
        return fallback

    models = ["gemini-flash-lite-latest", "gemini-2.5-flash"]
    for model in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={gemini_key}"
        body: dict[str, Any] = {
            "contents": [{"parts": [{"text": _GEMINI_NLQ_PROMPT + query}]}],
            "generationConfig": {"temperature": 0.0, "maxOutputTokens": 256},
        }
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(4.0, connect=2.0)) as client:
                resp = await client.post(url, json=body)
            if resp.status_code != 200:
                logger.debug("Gemini NLQ %s returned %s", model, resp.status_code)
                continue
            text = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
            parsed: dict[str, Any] = json.loads(text)
            logger.info("NLQ upgraded asynchronously by Gemini model %s", model)
            return _build_upgraded_response(query, parsed)
        except Exception as exc:  # noqa: BLE001
            logger.debug("Gemini async NLQ upgrade failed on %s: %s", model, exc)

    return fallback


def _gemini_upgrade(query: str, fallback: NLQParseResponse) -> NLQParseResponse:
    """Synchronous Gemini semantic parser fallback."""
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    if not gemini_key:
        return fallback

    models = ["gemini-flash-lite-latest", "gemini-2.5-flash"]
    for model in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={gemini_key}"
        body: dict[str, Any] = {
            "contents": [{"parts": [{"text": _GEMINI_NLQ_PROMPT + query}]}],
            "generationConfig": {"temperature": 0.0, "maxOutputTokens": 256},
        }
        try:
            with httpx.Client(timeout=httpx.Timeout(4.0, connect=2.0)) as client:
                resp = client.post(url, json=body)
            if resp.status_code != 200:
                logger.debug("Gemini NLQ %s returned %s", model, resp.status_code)
                continue
            text = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
            parsed: dict[str, Any] = json.loads(text)
            logger.info("NLQ upgraded synchronously by Gemini model %s", model)
            return _build_upgraded_response(query, parsed)
        except Exception as exc:  # noqa: BLE001
            logger.debug("Gemini NLQ upgrade failed on %s: %s", model, exc)

    return fallback


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def parse_natural_language_query_async(query: str) -> NLQParseResponse:
    """Non-blocking asynchronous NLQ parser."""
    result, confidence = _deterministic_parse(query)
    if confidence < 0.70:
        result = await _gemini_upgrade_async(query, result)
    return result


def parse_natural_language_query(query: str) -> NLQParseResponse:
    """
    Parse a natural-language climate query into a structured AnalysisRequest.
    Uses deterministic regex first; upgrades with Gemini when confidence is low
    and GEMINI_API_KEY is configured.
    """
    result, confidence = _deterministic_parse(query)

    # Upgrade with LLM when deterministic confidence is below threshold
    if confidence < 0.70:
        logger.info("NLQ confidence %.2f < 0.70 — attempting Gemini semantic upgrade.", confidence)
        result = _gemini_upgrade(query, result)

    return result
