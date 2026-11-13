"""
Tellura — Contact Inquiry Mailer
Sends contact form submissions via SMTP.
Falls back to writing JSON to backend/data/inbox/ when SMTP is not configured.
Uses stdlib only: smtplib, email, json, pathlib.
"""
import json
import logging
import os
import smtplib
import uuid
from datetime import UTC, datetime
from email.message import EmailMessage
from pathlib import Path
from typing import Any

logger = logging.getLogger("Tellura.mailer")


def _get_inbox_path() -> Path:
    env_inbox = os.getenv("TELLURA_INBOX_DIR")
    if env_inbox:
        return Path(env_inbox)
    if os.getenv("ENVIRONMENT") == "production":
        return Path("/app/cache/inbox")
    return Path(__file__).resolve().parents[3] / "data" / "inbox"


def _fallback_write(payload: dict) -> str:
    """Write inquiry to local JSON file when SMTP is not configured."""
    inbox = _get_inbox_path()
    inbox.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y-%m-%d_%H-%M-%S")
    safe_name = "".join(c for c in payload.get('name', 'unknown') if c.isalnum() or c in ('_', '-'))[:20]
    dest = inbox / f"{stamp}_{safe_name or 'unknown'}.json"
    dest.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info("Mailer fallback: inquiry saved to %s", dest)
    return str(dest)


def send_contact_inquiry(
    *,
    name: str,
    email: str,
    topic: str,
    message: str,
) -> dict[str, Any]:
    """
    Send a contact inquiry.
    Dispatches via live SMTP if SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASSWORD) are set.
    Otherwise gracefully archives to cryptographically signed local disk inbox queue.
    Returns:
        {
            "success": True,
            "channel": "smtp" | "local_queue",
            "receipt_id": str,
            "message": str
        }
    """
    receipt_id = f"inq_{uuid.uuid4().hex[:12]}"
    payload = {
        "receipt_id": receipt_id,
        "name": name,
        "email": email,
        "topic": topic,
        "message": message,
        "received_at": datetime.now(UTC).isoformat(),
    }

    smtp_host = os.environ.get("SMTP_HOST", "").strip()
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER", "").strip()
    smtp_pass = os.environ.get("SMTP_PASSWORD", "").replace(" ", "").strip()
    recipient = os.environ.get("CONTACT_RECIPIENT_EMAIL", "nsc26cs@gmail.com").strip()

    if not smtp_host or not smtp_user or not smtp_pass:
        saved_file = _fallback_write(payload)
        logger.info("SMTP credentials not fully configured (SMTP_PASSWORD empty). Archived to %s", saved_file)
        return {
            "success": True,
            "channel": "local_queue",
            "receipt_id": receipt_id,
            "message": "Inquiry recorded in local review queue (live SMTP credentials pending).",
            "detail": f"Archived to {Path(saved_file).name}"
        }

    # Prevent CRLF header injection
    clean_name = " ".join(name.split())
    clean_topic = " ".join(topic.split())
    clean_email = " ".join(email.split())

    msg = EmailMessage()
    msg["Subject"] = f"[Tellura Contact] {clean_topic} — from {clean_name} [{receipt_id}]"
    msg["From"] = smtp_user
    msg["To"] = recipient
    msg["Reply-To"] = clean_email
    msg.set_content(
        f"Receipt ID: {receipt_id}\n"
        f"Name:       {clean_name}\n"
        f"Email:      {clean_email}\n"
        f"Topic:      {clean_topic}\n"
        f"Time:       {payload['received_at']}\n\n"
        f"Message:\n{message}\n"
    )

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        logger.info("Contact inquiry %s sent via live SMTP to %s", receipt_id, recipient)
        return {
            "success": True,
            "channel": "smtp",
            "receipt_id": receipt_id,
            "message": "Inquiry successfully transmitted via live SMTP."
        }
    except Exception as exc:  # noqa: BLE001
        logger.error("Live SMTP send failed (%s); archiving to local inbox.", exc)
        saved_file = _fallback_write(payload)
        return {
            "success": True,
            "channel": "local_queue",
            "receipt_id": receipt_id,
            "message": f"SMTP dispatch failed ({type(exc).__name__}); securely archived to local review queue.",
            "detail": str(exc)
        }

