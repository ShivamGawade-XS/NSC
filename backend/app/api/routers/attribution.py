"""
Tellura — Climate Event Attribution Router.
Calculates Fraction of Attributable Risk (FAR) and Risk Ratio (RR) under Stott (2004) framework.
"""
import logging
from typing import Any

from fastapi import APIRouter, Request

from app.core.limiter import limiter
from app.science.attribution import compute_event_attribution

logger = logging.getLogger("Tellura.api.attribution")

router = APIRouter(tags=["Attribution"])


@router.post("/analysis/attribution")
@limiter.limit("30/minute")
def run_attribution_analysis(
    request: Request,
    payload: dict[str, Any]
) -> dict[str, Any]:
    """Calculate Fraction of Attributable Risk (FAR) and Risk Ratio (RR) under Stott (2004) framework."""
    slope = float(payload.get("slope", 0.15))
    n_years = int(payload.get("n_years", 24))
    series = payload.get("series")
    alpha = float(payload.get("alpha", 0.05))
    threshold_percentile = float(payload.get("threshold_percentile", 90.0))

    return compute_event_attribution(
        slope=slope,
        n_years=n_years,
        series=series,
        alpha=alpha,
        threshold_percentile=threshold_percentile
    )

