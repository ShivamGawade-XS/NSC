"""
Tellura — Copilot and Scientific Explanation Router.
Provides natural language query parsing and AI evidence synthesis with budget caps.
"""
import logging

from fastapi import APIRouter, Request

from app.core.auth import AuthTier, get_auth_tier, llm_budget_tracker
from app.core.limiter import limiter
from app.schemas.analysis import (
    ExplainRequest,
    ExplainResponse,
    NLQParseRequest,
    NLQParseResponse,
)
from app.science.explainer import deterministic_fallback_explanation, explain_evidence_with_ai_async
from app.science.nlq_parser import parse_natural_language_query_async

logger = logging.getLogger("Tellura.api.copilot")

router = APIRouter(tags=["Copilot"])

_EXPLAIN_CACHE: dict[str, ExplainResponse] = {}
_MAX_EXPLAIN_CACHE_SIZE = 100


@router.post("/explain", response_model=ExplainResponse)
@limiter.limit("20/minute")
async def explain_evidence(request: Request, req: ExplainRequest) -> ExplainResponse:
    """
    Downstream scientific explainer:
    - Cached: returns identical previous explanation in <1ms without burning AI quota.
    - All tiers: queries external LLM (Gemini) with anti-hallucination guardrails.
    - Falls back to deterministic scientific template if LLM is offline or budget exhausted.
    - Keyed tier: not subject to daily LLM budget (unlimited).
    - Anonymous tier: subject to global daily LLM budget; falls back gracefully.
    """
    cache_key = f"{req.variable_name}|{req.location}|{req.time_span}|{req.slope:.4f}|{req.significant}"
    if cache_key in _EXPLAIN_CACHE:
        return _EXPLAIN_CACHE[cache_key]

    tier = get_auth_tier(request)

    # Keyed tier skips budget check
    if tier == AuthTier.KEYED:
        result = await explain_evidence_with_ai_async(req)
    elif not llm_budget_tracker.check_and_increment():
        # Anonymous tier: check daily LLM budget first
        logger.warning("Daily LLM call budget reached; returning deterministic template.")
        result = deterministic_fallback_explanation(req)
    else:
        result = await explain_evidence_with_ai_async(req)

    if len(_EXPLAIN_CACHE) >= _MAX_EXPLAIN_CACHE_SIZE:
        _EXPLAIN_CACHE.pop(next(iter(_EXPLAIN_CACHE)))
    _EXPLAIN_CACHE[cache_key] = result
    return result


@router.post("/copilot/parse-query", response_model=NLQParseResponse)
@limiter.limit("30/minute")
async def parse_natural_language_scientific_query(request: Request, req: NLQParseRequest) -> NLQParseResponse:
    """
    Tellura NLQ Semantic Copilot:
    Translates free-form natural language queries into verified Pydantic AnalysisRequests.
    Non-blocking async execution.
    """
    return await parse_natural_language_query_async(req.query)

