"""
Email sender — Gmail SMTP via app password.
Requires env vars: GMAIL_APP_PASSWORD, FOUNDER_EMAIL
"""

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


def _build_html(title: str, body_text: str, guide_url: str = "", accent: str = "#1a1a2e") -> str:
    lines = body_text.split("\n")
    parts = []
    para_lines = []

    def flush_para():
        if para_lines:
            text = " ".join(para_lines)
            parts.append(f'<p style="margin:4px 0;line-height:1.7;color:#333">{text}</p>')
            para_lines.clear()

    for line in lines:
        s = line.strip()
        if not s:
            flush_para()
            parts.append("<br>")
        elif s.startswith("━") or s.startswith("─") or s.startswith("═"):
            flush_para()
            parts.append('<hr style="border:none;border-top:1px solid #eee;margin:10px 0">')
        elif s.startswith("# "):
            flush_para()
            parts.append(f'<h1 style="color:{accent};font-size:20px;margin:16px 0 8px">{s[2:]}</h1>')
        elif s.startswith("## "):
            flush_para()
            parts.append(f'<h2 style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;margin:20px 0 6px">{s[3:]}</h2>')
        elif s.startswith(("🟢", "🟡", "🟠", "🔴", "💰", "📋", "📊", "💼", "✅", "❌", "➡️", "⚠️", "🚨")):
            flush_para()
            parts.append(f'<p style="margin:8px 0 2px;line-height:1.6;color:#333;font-weight:600">{s}</p>')
        else:
            para_lines.append(s)

    flush_para()

    guide_btn = ""
    if guide_url:
        guide_btn = f'''<div style="text-align:center;margin:24px 0 8px">
          <a href="{guide_url}" style="display:inline-block;background:{accent};color:#fff;padding:13px 32px;border-radius:7px;text-decoration:none;font-weight:600;font-size:14px">
            📋 Istruzioni passo-passo →
          </a>
          <p style="font-size:11px;color:#aaa;margin:8px 0 0">Apri dal browser del tuo dispositivo</p>
        </div>'''

    return f"""<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"></head>
<body style="margin:0;padding:16px;background:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.12)">
    <div style="background:{accent};padding:24px 28px">
      <p style="color:rgba(255,255,255,.6);margin:0 0 4px;font-size:11px;letter-spacing:1px;text-transform:uppercase">The Wolf of Italy</p>
      <h1 style="color:#fff;margin:0;font-size:21px;font-weight:700;line-height:1.3">{title}</h1>
    </div>
    <div style="padding:24px 28px 16px">
      {"".join(parts)}
      {guide_btn}
    </div>
    <div style="padding:12px 28px;background:#fafafa;border-top:1px solid #eee">
      <p style="margin:0;font-size:11px;color:#bbb">Sistema automatico — non rispondere a questa email</p>
    </div>
  </div>
</body></html>"""


async def send_proposal_email(subject: str, body: str, guide_url: str = "") -> dict:
    """Send Investment Alert email to founder."""
    return await _send(subject, body, guide_url)


async def send_critical_alert(subject: str, body: str) -> dict:
    """Send critical security/monitor alert email."""
    return await _send(f"🚨 {subject}", body)


async def _send(subject: str, body: str, guide_url: str = "") -> dict:
    gmail_user = "nicolostancato@gmail.com"
    app_password = os.environ.get("GMAIL_APP_PASSWORD", "")
    founder_email = os.environ.get("FOUNDER_EMAIL", "nicolostancato@gmail.com")

    if not app_password:
        return {"ok": False, "error": "GMAIL_APP_PASSWORD not set", "subject": subject}

    is_alert = any(w in subject.lower() for w in ("alert", "critico", "urgente", "🚨", "compromesso"))
    accent = "#c0392b" if is_alert else "#1a1a2e"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"[Wolf] {subject}"
    msg["From"] = gmail_user
    msg["To"] = founder_email

    msg.attach(MIMEText(body, "plain", "utf-8"))
    title = next((l.lstrip("# ").strip() for l in body.split("\n") if l.strip()), subject)
    msg.attach(MIMEText(_build_html(title, body, guide_url, accent), "html", "utf-8"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(gmail_user, app_password)
            server.sendmail(gmail_user, founder_email, msg.as_string())
        return {"ok": True, "to": founder_email, "subject": subject}
    except Exception as e:
        return {"ok": False, "error": str(e), "subject": subject}
