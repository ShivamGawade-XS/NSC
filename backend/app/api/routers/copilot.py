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


@router.post("/explain", response_model=ExplainResponse)
@limiter.limit("20/minute")
async def explain_evidence(request: Request, req: ExplainRequest) -> ExplainResponse:
    """
    Downstream scientific explainer:
    - All tiers: queries external LLM (Gemini) with anti-hallucination guardrails.
    - Falls back to deterministic scientific template if LLM is offline or budget exhausted.
    - Keyed tier: not subject to daily LLM budget (unlimited).
    - Anonymous tier: subject to global daily LLM budget; falls back gracefully.
    """
    tier = get_auth_tier(request)

    # Keyed tier skips budget check
    if tier == AuthTier.KEYED:
        return await explain_evidence_with_ai_async(req)

    # Anonymous tier: check daily LLM budget first
    if not llm_budget_tracker.check_and_increment():
        logger.warning("Daily LLM call budget reached; returning deterministic template.")
        return deterministic_fallback_explanation(req)

    return await explain_evidence_with_ai_async(req)


@router.post("/copilot/parse-query", response_model=NLQParseResponse)
@limiter.limit("30/minute")
async def parse_natural_language_scientific_query(request: Request, req: NLQParseRequest) -> NLQParseResponse:
    """
    Tellura NLQ Semantic Copilot:
    Translates free-form natural language queries into verified Pydantic AnalysisRequests.
    Non-blocking async execution.
    """
    return await parse_natural_language_query_async(req.query)

