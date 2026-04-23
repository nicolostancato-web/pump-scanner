"""
TESTER — Wolf of Italy v4
Pure-Python hourly health check. No LLM. Checks KB freshness + dashboard endpoints.
Saves JSON to knowledge_base/tester_alerts/{date}.json
Sends email on issues via send_critical_alert.
"""

import asyncio
import json
import os
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import httpx

ROME = ZoneInfo("Europe/Rome")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "nicolostancato-web/pump-scanner")
KB = "the-wolf-of-italy/knowledge_base"
BASE_URL = f"https://api.github.com/repos/{GITHUB_REPO}/contents"
COMMITS_URL = f"https://api.github.com/repos/{GITHUB_REPO}/commits"
DASHBOARD_URL = os.environ.get("DASHBOARD_URL", "https://pump-scanner-production.up.railway.app")

_GH_HEADERS = {"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"}


async def _last_modified(path: str) -> datetime | None:
    """Return UTC datetime of last commit touching this path."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(COMMITS_URL, params={"path": path, "per_page": 1},
                                 headers=_GH_HEADERS)
            if r.status_code == 200:
                commits = r.json()
                if commits:
                    ts = commits[0]["commit"]["committer"]["date"]
                    return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except Exception:
        pass
    return None


async def _file_exists(path: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{BASE_URL}/{path}", headers=_GH_HEADERS)
            return r.status_code == 200
    except Exception:
        return False


async def _check_endpoint(url: str) -> tuple[int, str]:
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            r = await client.get(url, headers={"User-Agent": "wolf-tester/1.0"})
            return r.status_code, ""
    except Exception as e:
        return 0, str(e)[:120]


async def run_tester_check() -> dict:
    now = datetime.now(ROME)
    today = now.strftime("%Y-%m-%d")
    now_utc = datetime.now(timezone.utc)
    checks = {}
    alerts = []

    # ── HUNTER: opportunities/{today}.md should exist and be < 2h old ──────────
    hunter_path = f"{KB}/opportunities/{today}.md"
    hunter_exists = await _file_exists(hunter_path)
    if hunter_exists:
        last = await _last_modified(hunter_path)
        if last:
            age_min = int((now_utc - last).total_seconds() / 60)
            if age_min > 120:
                checks["HUNTER"] = {"status": "WARN", "msg": f"ultimo run {age_min}m fa (>2h)"}
                alerts.append(f"HUNTER: file {age_min}m fa, atteso <2h")
            else:
                checks["HUNTER"] = {"status": "OK", "msg": f"aggiornato {age_min}m fa"}
        else:
            checks["HUNTER"] = {"status": "OK", "msg": "file esiste, commit non tracciabile"}
    else:
        checks["HUNTER"] = {"status": "WARN", "msg": f"nessun file opportunità oggi ({today})"}
        alerts.append(f"HUNTER: nessun file opportunità per {today}")

    # ── ANALISTA: pending_decisions.md should exist ──────────────────────────
    analista_exists = await _file_exists(f"{KB}/analysis/pending_decisions.md")
    if analista_exists:
        last = await _last_modified(f"{KB}/analysis/pending_decisions.md")
        if last:
            age_h = int((now_utc - last).total_seconds() / 3600)
            checks["ANALISTA"] = {"status": "OK", "msg": f"pending_decisions {age_h}h fa"}
        else:
            checks["ANALISTA"] = {"status": "OK", "msg": "file esiste"}
    else:
        checks["ANALISTA"] = {"status": "WARN", "msg": "pending_decisions.md non trovato"}
        alerts.append("ANALISTA: pending_decisions.md mancante")

    # ── CFO: active_positions.md should exist and be < 5h old ────────────────
    cfo_path = f"{KB}/portfolio/active_positions.md"
    cfo_exists = await _file_exists(cfo_path)
    if cfo_exists:
        last = await _last_modified(cfo_path)
        if last:
            age_h = int((now_utc - last).total_seconds() / 3600)
            if age_h > 5:
                checks["CFO"] = {"status": "WARN", "msg": f"active_positions {age_h}h fa (>5h)"}
                alerts.append(f"CFO: active_positions.md aggiornato {age_h}h fa, atteso <5h")
            else:
                checks["CFO"] = {"status": "OK", "msg": f"active_positions {age_h}h fa"}
        else:
            checks["CFO"] = {"status": "OK", "msg": "file esiste"}
    else:
        checks["CFO"] = {"status": "WARN", "msg": "active_positions.md non trovato"}
        alerts.append("CFO: active_positions.md mancante")

    # ── MONITOR: monitor/{today}.md should exist after 08:00 ─────────────────
    monitor_path = f"{KB}/monitor/{today}.md"
    monitor_exists = await _file_exists(monitor_path)
    if now.hour >= 8:
        if monitor_exists:
            checks["MONITOR"] = {"status": "OK", "msg": f"report oggi ({today}) presente"}
        else:
            checks["MONITOR"] = {"status": "WARN", "msg": f"report {today} non ancora creato"}
            alerts.append(f"MONITOR: nessun report per {today} dopo le 08:00")
    else:
        checks["MONITOR"] = {"status": "PENDING", "msg": "report atteso dopo 08:00"}

    # ── SECURITY: security_state.md should exist and be < 2h old ─────────────
    sec_path = f"{KB}/security_state.md"
    sec_exists = await _file_exists(sec_path)
    if sec_exists:
        last = await _last_modified(sec_path)
        if last:
            age_min = int((now_utc - last).total_seconds() / 60)
            if age_min > 120:
                checks["SECURITY"] = {"status": "WARN", "msg": f"security_state {age_min}m fa (>2h)"}
                alerts.append(f"SECURITY: security_state.md {age_min}m fa, atteso <2h")
            else:
                checks["SECURITY"] = {"status": "OK", "msg": f"security_state {age_min}m fa"}
        else:
            checks["SECURITY"] = {"status": "OK", "msg": "file esiste"}
    else:
        checks["SECURITY"] = {"status": "WARN", "msg": "security_state.md non trovato"}
        alerts.append("SECURITY: security_state.md mancante")

    # ── TESTER: self-check ────────────────────────────────────────────────────
    checks["TESTER"] = {"status": "OK", "msg": f"eseguito alle {now.strftime('%H:%M')}"}

    # ── Dashboard endpoint checks ─────────────────────────────────────────────
    tabs = ["/", "/hunter", "/analista", "/vault", "/archivio", "/monitor", "/security", "/health-tab"]
    dashboard_issues = []
    for tab in tabs:
        code, err = await _check_endpoint(DASHBOARD_URL + tab)
        if code not in (200, 302):
            dashboard_issues.append(f"{tab} → {code} {err}")
    if dashboard_issues:
        alerts.extend([f"DASHBOARD: {issue}" for issue in dashboard_issues])

    result = {
        "timestamp": now.isoformat(),
        "date": today,
        "checks": checks,
        "alerts": alerts,
        "dashboard_issues": dashboard_issues,
    }
    return result


async def save_tester_result(result: dict) -> None:
    """Save JSON result to KB and markdown summary."""
    from tools.github_memory import kb_write
    today = result["date"]
    await kb_write(
        f"tester_alerts/{today}.json",
        json.dumps(result, indent=2, ensure_ascii=False),
        f"TESTER: health check {result['timestamp'][:16]}",
    )
    if result["alerts"]:
        lines = [f"# TESTER Alert — {today}", f"_{result['timestamp'][:16]}_", ""]
        for a in result["alerts"]:
            lines.append(f"- ⚠️ {a}")
        await kb_write(
            f"tester_alerts/{today}.md",
            "\n".join(lines),
            f"TESTER: {len(result['alerts'])} alert",
        )


async def task() -> dict:
    result = await run_tester_check()
    await save_tester_result(result)
    if result["alerts"]:
        try:
            from tools.email_sender import send_critical_alert
            body = f"TESTER — {result['timestamp'][:16]}\n\nAlert:\n" + "\n".join(f"• {a}" for a in result["alerts"])
            await send_critical_alert(f"[Wolf] TESTER: {len(result['alerts'])} problemi rilevati", body)
        except Exception:
            pass
    return result
