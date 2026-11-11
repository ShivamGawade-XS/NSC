"""
EarthSift — Contact Inquiry Mailer
Sends contact form submissions via SMTP.
Falls back to writing JSON to backend/data/inbox/ when SMTP is not configured.
Uses stdlib only: smtplib, email, json, pathlib.
"""
import json
import logging
import os
import smtplib
from datetime import UTC, datetime
from email.message import EmailMessage
from pathlib import Path

logger = logging.getLogger("earthsift.mailer")

_INBOX = Path(__file__).resolve().parents[3] / "data" / "inbox"


def _fallback_write(payload: dict) -> str:
    """Write inquiry to local JSON file when SMTP is not configured."""
    _INBOX.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y-%m-%d_%H-%M-%S")
    dest = _INBOX / f"{stamp}_{payload.get('name','unknown').replace(' ','_')[:20]}.json"
    dest.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info("Mailer fallback: inquiry saved to %s", dest)
    return str(dest)


def send_contact_inquiry(
    *,
    name: str,
    email: str,
    topic: str,
    message: str,
) -> bool:
    """
    Send a contact inquiry.
    Returns True on success (SMTP or fallback file write).
    Raises RuntimeError on unrecoverable failure.
    """
    payload = {
        "name": name,
        "email": email,
        "topic": topic,
        "message": message,
        "received_at": datetime.now(UTC).isoformat(),
    }

    smtp_host = os.environ.get("SMTP_HOST", "")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_pass = os.environ.get("SMTP_PASSWORD", "")
    recipient = os.environ.get("CONTACT_RECIPIENT_EMAIL", "shivamgawade.dev@gmail.com")

    if not smtp_host or not smtp_user or not smtp_pass:
        logger.warning("SMTP not configured — saving inquiry to local inbox.")
        _fallback_write(payload)
        return True

    msg = EmailMessage()
    msg["Subject"] = f"[Tellura Contact] {topic} — from {name}"
    msg["From"] = smtp_user
    msg["To"] = recipient
    msg["Reply-To"] = email
    msg.set_content(
        f"Name:    {name}\n"
        f"Email:   {email}\n"
        f"Topic:   {topic}\n"
        f"Time:    {payload['received_at']}\n\n"
        f"Message:\n{message}\n"
    )

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        logger.info("Contact inquiry sent via SMTP to %s", recipient)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.error("SMTP send failed (%s); saving to local inbox.", exc)
        _fallback_write(payload)
        return True  # graceful degradation — inquiry is not lost

