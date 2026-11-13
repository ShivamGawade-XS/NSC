"""
Tellura — System & Operational Telemetry Router.
Provides health check probes, contact inquiry processing, and privacy-preserving telemetry.
"""
import asyncio
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from app.api.shared import ADAPTERS
from app.core.limiter import limiter
from app.core.mailer import send_contact_inquiry
from app.schemas.analysis import (
    ContactInquiryRequest,
    ContactInquiryResponse,
    TelemetryEvent,
    TelemetryResponse,
)

logger = logging.getLogger("Tellura.api.system")

router = APIRouter(tags=["System"])


@router.get("/health")
@limiter.limit("60/minute")
async def health_check(request: Request) -> dict[str, Any]:
    """Lightweight public API health and engine status probe."""
    return {
        "status": "healthy",
        "service": "Tellura Scientific API",
        "version": "1.0.0",
        "engine": "Mann-Kendall + Theil-Sen + Benjamini-Hochberg FDR",
        "adapters": list(ADAPTERS.keys()),
    }


@router.post("/contact", response_model=ContactInquiryResponse)
@limiter.limit("5/minute")
async def submit_contact(request: Request, req: ContactInquiryRequest) -> ContactInquiryResponse:
    """
    Accepts a contact form submission.
    Dispatches via SMTP when configured; falls back to local JSON inbox.
    """
    try:
        result = await asyncio.to_thread(
            send_contact_inquiry,
            name=req.name,
            email=req.email,
            topic=req.topic,
            message=req.message,
        )
        return ContactInquiryResponse(
            success=result["success"],
            message=result["message"],
            delivery_channel=result["channel"],
            receipt_id=result["receipt_id"],
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("Contact submission error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to submit contact inquiry.") from exc


@router.post("/telemetry", response_model=TelemetryResponse)
@limiter.limit("60/minute")
async def record_telemetry(request: Request, event: TelemetryEvent) -> TelemetryResponse:
    """
    Accepts anonymised front-end analytics events.
    Persists to SQLite telemetry table. No PII is stored.
    """
    from app.core.db_cache import save_telemetry_event
    try:
        await asyncio.to_thread(save_telemetry_event, event.event, event.page, event.properties)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Telemetry write failed: %s", exc)
    return TelemetryResponse(recorded=True)

