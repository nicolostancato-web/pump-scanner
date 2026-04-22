"""
Email sender — Gmail SMTP via app password.
Requires env vars: GMAIL_APP_PASSWORD, FOUNDER_EMAIL
"""

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


async def send_proposal_email(subject: str, body: str) -> dict:
    """Send action proposal email to founder."""
    gmail_user = "nicolostancato@gmail.com"
    app_password = os.environ.get("GMAIL_APP_PASSWORD", "")
    founder_email = os.environ.get("FOUNDER_EMAIL", "nicolostancato@gmail.com")

    if not app_password:
        return {
            "ok": False,
            "error": "GMAIL_APP_PASSWORD not set in env vars — add it to Railway variables",
            "subject": subject,
        }

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"[Wolf] {subject}"
    msg["From"] = gmail_user
    msg["To"] = founder_email

    text_part = MIMEText(body, "plain", "utf-8")
    html_body = body.replace("\n", "<br>")
    html_part = MIMEText(
        f"<html><body style='font-family:monospace'>{html_body}</body></html>",
        "html",
        "utf-8",
    )
    msg.attach(text_part)
    msg.attach(html_part)

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(gmail_user, app_password)
            server.sendmail(gmail_user, founder_email, msg.as_string())
        return {"ok": True, "to": founder_email, "subject": subject}
    except Exception as e:
        return {"ok": False, "error": str(e), "subject": subject}
