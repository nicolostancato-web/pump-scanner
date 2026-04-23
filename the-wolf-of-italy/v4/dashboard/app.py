"""
Wolf of Italy v4 — Dashboard Web
Flask + HTMX + Alpine.js. 9 tab. UI italiana.
"""

import base64
import json
import os
import re
from datetime import datetime, timedelta
from functools import wraps
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
from flask import (Flask, abort, jsonify, redirect, render_template,
                   request, session, url_for)

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET", "wolf-secret-change-me")

DASHBOARD_PASSWORD = os.environ.get("DASHBOARD_PASSWORD", "wolf2024")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
REPO = os.environ.get("GITHUB_REPO", "nicolostancato-web/pump-scanner")
KB = "the-wolf-of-italy/knowledge_base"
ROME = ZoneInfo("Europe/Rome")
BASE_URL = f"https://api.github.com/repos/{REPO}/contents"


# ── GitHub helpers ─────────────────────────────────────────────────────────────

def _gh_headers():
    return {"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"}


def gh_read(path: str) -> str | None:
    try:
        r = httpx.get(f"{BASE_URL}/{path}", headers=_gh_headers(), timeout=10)
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return base64.b64decode(r.json()["content"]).decode("utf-8")
    except Exception:
        return None


def gh_list(path: str) -> list[dict]:
    try:
        r = httpx.get(f"{BASE_URL}/{path}", headers=_gh_headers(), timeout=10)
        if r.status_code == 404:
            return []
        r.raise_for_status()
        return [f for f in r.json() if f["type"] == "file" and not f["name"].startswith(".")]
    except Exception:
        return []


def gh_write(path: str, content: str, message: str) -> bool:
    try:
        encoded = base64.b64encode(content.encode()).decode()
        existing = httpx.get(f"{BASE_URL}/{path}", headers=_gh_headers(), timeout=10)
        body = {"message": message, "content": encoded}
        if existing.status_code == 200:
            body["sha"] = existing.json()["sha"]
        r = httpx.put(f"{BASE_URL}/{path}", json=body, headers=_gh_headers(), timeout=10)
        return r.status_code in (200, 201)
    except Exception:
        return False


# ── Parsing ────────────────────────────────────────────────────────────────────

def parse_pending_decisions(content: str) -> list[dict]:
    if not content:
        return []
    bps, current = [], {}
    for line in content.split("\n"):
        line = line.strip()
        if line == "---":
            if current.get("id_bp"):
                bps.append(current)
            current = {}
        elif ":" in line and not line.startswith("#"):
            key, _, val = line.partition(":")
            current[key.strip()] = val.strip()
    if current.get("id_bp"):
        bps.append(current)
    return bps


def parse_active_positions(content: str) -> list[dict]:
    """Parse active_positions.md — handles Italian field names from CFO agent."""
    if not content:
        return []
    positions, current = [], {}
    for line in content.split("\n"):
        s = line.strip()
        if s.startswith("## "):
            if current.get("name"):
                positions.append(current)
            current = {"name": s.lstrip("# ").strip()}
        elif s.startswith("#") or s.startswith("|") or s.startswith("---") or s.startswith("Steps") or s.startswith("Alert") or s.startswith("Posizioni"):
            continue
        elif ":" in s and current.get("name"):
            k, _, v = s.partition(":")
            k, v = k.strip(), v.strip()
            current[k] = v
            lk = k.lower()
            # Normalize Italian field names
            if "capitale" in lk or ("investit" in lk):
                current["invested"] = v.split("(")[0].strip()
            elif "valore" in lk and "attual" in lk:
                current["current_value"] = v.split("(")[0].strip()
            elif lk in ("stato", "status"):
                current["status"] = v
            elif "drop" in lk:
                current["drop_atteso"] = v
    if current.get("name"):
        positions.append(current)
    return [p for p in positions if p.get("name") and "Riepilogo" not in p.get("name", "")]


def parse_portfolio_summary(active_raw: str) -> dict:
    """Extract cash and totals from the Riepilogo table in active_positions.md."""
    result = {"cash": 0.0, "positions_total": 0.0, "portfolio_total": 0.0}
    if not active_raw:
        return result
    for line in active_raw.split("\n"):
        s = line.strip()
        m = re.search(r"Cash[^|]*\|.*?\$([\d,.]+)", s)
        if m:
            result["cash"] = _try_float(m.group(1))
        m = re.search(r"Portfolio totale.*?\$([\d,.]+)", s, re.IGNORECASE)
        if m:
            result["portfolio_total"] = _try_float(m.group(1))
        m = re.search(r"Posizioni attive.*?\$([\d,.]+)", s, re.IGNORECASE)
        if m:
            result["positions_total"] = _try_float(m.group(1))
    return result


def parse_parked_files(files: list[dict]) -> list[dict]:
    items = []
    for f in sorted(files, key=lambda x: x["name"]):
        content = gh_read(f["path"])
        if content:
            bp = {"id": f["name"].replace(".md", ""), "raw": content}
            for line in content.split("\n")[:25]:
                if ":" in line and not line.startswith("#"):
                    k, _, v = line.partition(":")
                    bp[k.strip()] = v.strip()
            items.append(bp)
    return items


def _try_float(val: str) -> float:
    try:
        return float(str(val).replace("$", "").replace(",", "").strip())
    except Exception:
        return 0.0


def _extract_cash(report: str) -> float:
    if not report:
        return 0.0
    m = re.search(r"[Cc]ash[^:\|]*[:\|]\s*\$?([\d,.]+)", report)
    if m:
        return _try_float(m.group(1))
    return 0.0


# ── Auth ───────────────────────────────────────────────────────────────────────

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("logged_in"):
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated


def _common_ctx():
    pending_raw = gh_read(f"{KB}/analysis/pending_decisions.md")
    bps = parse_pending_decisions(pending_raw)
    return {"pending_count": len(bps)}


@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        if request.form.get("password") == DASHBOARD_PASSWORD:
            session["logged_in"] = True
            return redirect(url_for("overview"))
        error = "Password errata"
    return render_template("login.html", error=error)


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/health")
def health():
    return {"status": "ok", "time": datetime.now(ROME).isoformat()}


# ── TAB 1 — OVERVIEW ──────────────────────────────────────────────────────────

@app.route("/")
@login_required
def overview():
    today = datetime.now(ROME).strftime("%Y-%m-%d")
    active_raw = gh_read(f"{KB}/portfolio/active_positions.md")
    positions = parse_active_positions(active_raw)
    summary = parse_portfolio_summary(active_raw)
    pending_raw = gh_read(f"{KB}/analysis/pending_decisions.md")
    bps = parse_pending_decisions(pending_raw)
    monitor_raw = gh_read(f"{KB}/monitor/{today}.md") or ""
    sec_state = gh_read(f"{KB}/security_state.md") or ""
    opp_raw = gh_read(f"{KB}/opportunities/{today}.md") or ""

    portfolio_total = summary["portfolio_total"] or sum(_try_float(p.get("current_value", "0")) for p in positions)
    cash_free = summary["cash"]
    alert_count = monitor_raw.count("\U0001f6a8") + monitor_raw.count("\u26a0") + monitor_raw.count("🚨") + monitor_raw.count("⚠️")
    sec_ok = "critico" not in sec_state.lower() and "alert" not in sec_state.lower()

    opp_lines = [l.strip() for l in opp_raw.split("\n") if l.strip() and not l.startswith("#")]
    activity_feed = opp_lines[:8]

    return render_template("overview.html",
                           positions=positions, bps=bps,
                           portfolio_total=portfolio_total, cash_free=cash_free,
                           alert_count=alert_count, sec_ok=sec_ok,
                           activity_feed=activity_feed, today=today,
                           active_tab="overview", **_common_ctx())


# ── TAB 2 — HUNTER ────────────────────────────────────────────────────────────

@app.route("/hunter")
@login_required
def hunter():
    today = datetime.now(ROME).strftime("%Y-%m-%d")
    opp_raw = gh_read(f"{KB}/opportunities/{today}.md") or ""
    seen_raw = gh_read(f"{KB}/hunter_memory/seen_protocols.md") or ""

    opps = []
    current = {}
    for line in opp_raw.split("\n"):
        line = line.strip()
        if line == "---":
            if current.get("nome") or current.get("protocollo"):
                opps.append(current)
            current = {}
        elif ":" in line and not line.startswith("#"):
            k, _, v = line.partition(":")
            current[k.strip()] = v.strip()
    if current.get("nome") or current.get("protocollo"):
        opps.append(current)

    seen_count = seen_raw.count("\n- ") if seen_raw else 0

    return render_template("hunter.html", opps=opps, seen_count=seen_count,
                           today=today, active_tab="hunter", **_common_ctx())


# ── TAB 3 — ANALISTA ──────────────────────────────────────────────────────────

@app.route("/analista")
@login_required
def analista():
    today = datetime.now(ROME).strftime("%Y-%m-%d")
    try:
        pending_raw = gh_read(f"{KB}/analysis/pending_decisions.md")
        bps = parse_pending_decisions(pending_raw)
        parked_files = gh_list(f"{KB}/parked")
        parked = parse_parked_files(parked_files)
    except Exception as e:
        bps, parked = [], []
    return render_template("analista.html", bps=bps, parked=parked,
                           today=today, active_tab="analista",
                           pending_count=len(bps))


@app.route("/analista/decision", methods=["POST"])
@login_required
def make_decision():
    bp_id = request.form.get("bp_id", "")
    decision = request.form.get("decision", "")
    notes = request.form.get("notes", "")
    if not bp_id or decision not in ("ACCEPTED", "REJECTED", "PARKED"):
        abort(400)
    now = datetime.now(ROME).isoformat()
    new_entry = f"\nbp_id: {bp_id}\ndecision: {decision}\ntimestamp: {now}\nnotes: {notes}\n---\n"
    existing = gh_read(f"{KB}/analysis/decisions_queue.md") or ""
    gh_write(f"{KB}/analysis/decisions_queue.md", existing + new_entry,
             f"Dashboard: {decision} {bp_id}")
    return redirect(url_for("analista"))


@app.route("/analista/riattiva", methods=["POST"])
@login_required
def reactivate_parked():
    bp_id = request.form.get("bp_id", "")
    if not bp_id:
        abort(400)
    pending = gh_read(f"{KB}/analysis/pending_decisions.md") or ""
    now = datetime.now(ROME).isoformat()
    entry = f"\n---\nid_bp: {bp_id}\ntipo: parked\ntimestamp_proposto: {now}\npriority: medium\n---\n"
    gh_write(f"{KB}/analysis/pending_decisions.md", pending + entry,
             f"Dashboard: riattiva {bp_id}")
    return redirect(url_for("analista"))


# ── TAB 4 — VAULT ─────────────────────────────────────────────────────────────

@app.route("/vault")
@login_required
def vault():
    today = datetime.now(ROME).strftime("%Y-%m-%d")
    active_raw = gh_read(f"{KB}/portfolio/active_positions.md")
    positions = parse_active_positions(active_raw)
    summary = parse_portfolio_summary(active_raw)
    daily_report = gh_read(f"{KB}/portfolio/daily_report.md") or ""
    pending_raw_dep = gh_read(f"{KB}/portfolio/pending_deployment.md") or ""

    portfolio_total = summary["portfolio_total"] or sum(_try_float(p.get("current_value", "0")) for p in positions)
    cash_free = summary["cash"]
    invested = summary["positions_total"] or sum(_try_float(p.get("invested", "0")) for p in positions)

    return render_template("vault.html",
                           daily_report=daily_report, positions=positions,
                           pending_deployment=pending_raw_dep,
                           portfolio_total=portfolio_total, cash_free=cash_free,
                           invested=invested, today=today,
                           active_tab="vault", **_common_ctx())


@app.route("/vault/confirma_deploy", methods=["POST"])
@login_required
def confirm_deploy():
    bp_id = request.form.get("bp_id", "")
    if not bp_id:
        abort(400)
    content = gh_read(f"{KB}/portfolio/pending_deployment.md") or ""
    updated = content.replace(
        f"BP_ID: {bp_id}\nStato: PENDING_DEPLOYMENT",
        f"BP_ID: {bp_id}\nStato: DEPLOYMENT_CONFIRMED"
    )
    gh_write(f"{KB}/portfolio/pending_deployment.md", updated,
             f"Dashboard: deploy confermato {bp_id}")
    return redirect(url_for("vault"))


# ── TAB 5 — ARCHIVIO ──────────────────────────────────────────────────────────

@app.route("/archivio")
@login_required
def archivio():
    closed = gh_read(f"{KB}/portfolio/closed_positions.md") or ""
    archived_files = gh_list(f"{KB}/archived")
    archived = []
    for f in archived_files[:20]:
        content = gh_read(f["path"])
        if content:
            archived.append({"name": f["name"].replace(".md", ""), "content": content[:600]})
    seen = gh_read(f"{KB}/hunter_memory/seen_protocols.md") or ""
    parked_files = gh_list(f"{KB}/parked")
    parked = parse_parked_files(parked_files)

    return render_template("archivio.html", closed=closed, archived=archived,
                           seen=seen, parked=parked,
                           active_tab="archivio", **_common_ctx())


# ── TAB 6 — MONITOR ───────────────────────────────────────────────────────────

@app.route("/monitor")
@login_required
def monitor():
    today = datetime.now(ROME).strftime("%Y-%m-%d")
    monitor_log = gh_read(f"{KB}/monitor/{today}.md") or "Monitor non ancora eseguito oggi."
    active_raw = gh_read(f"{KB}/portfolio/active_positions.md")
    positions = parse_active_positions(active_raw)
    parked_files = gh_list(f"{KB}/parked")
    parked = parse_parked_files(parked_files)

    return render_template("monitor.html", monitor_log=monitor_log,
                           positions=positions, parked=parked,
                           today=today, active_tab="monitor", **_common_ctx())


# ── TAB 7 — SECURITY ──────────────────────────────────────────────────────────

@app.route("/security")
@login_required
def security():
    today = datetime.now(ROME).strftime("%Y-%m-%d")
    sec_state = gh_read(f"{KB}/security_state.md") or "Security state non disponibile."
    sec_alert = gh_read(f"{KB}/security_alerts/{today}.md")

    return render_template("security.html", sec_state=sec_state, sec_alert=sec_alert,
                           today=today, active_tab="security", **_common_ctx())


# ── TAB 8 — HEALTH ────────────────────────────────────────────────────────────

@app.route("/health-tab")
@login_required
def health_tab():
    today = datetime.now(ROME).strftime("%Y-%m-%d")
    tester_raw = gh_read(f"{KB}/tester_alerts/{today}.json")
    tester_data = None
    if tester_raw:
        try:
            tester_data = json.loads(tester_raw)
        except Exception:
            tester_data = None
    alerts_raw = gh_read(f"{KB}/tester_alerts/{today}.md") or ""
    return render_template("health.html", tester_data=tester_data,
                           alerts_raw=alerts_raw, today=today,
                           active_tab="health", **_common_ctx())


# ── TAB 9 — IMPOSTAZIONI ──────────────────────────────────────────────────────

@app.route("/impostazioni")
@login_required
def impostazioni():
    hunter_prompt = gh_read("the-wolf-of-italy/v4/prompts/hunter.md") or ""
    return render_template("impostazioni.html", hunter_prompt=hunter_prompt,
                           active_tab="impostazioni", **_common_ctx())


# ── HTMX partials ─────────────────────────────────────────────────────────────

@app.route("/api/kpi")
@login_required
def api_kpi():
    today = datetime.now(ROME).strftime("%Y-%m-%d")
    active_raw = gh_read(f"{KB}/portfolio/active_positions.md")
    positions = parse_active_positions(active_raw)
    summary = parse_portfolio_summary(active_raw)
    pending_raw = gh_read(f"{KB}/analysis/pending_decisions.md")
    bps = parse_pending_decisions(pending_raw)
    monitor_raw = gh_read(f"{KB}/monitor/{today}.md") or ""
    sec_state = gh_read(f"{KB}/security_state.md") or ""

    portfolio_total = summary["portfolio_total"] or sum(_try_float(p.get("current_value", "0")) for p in positions)
    cash_free = summary["cash"]
    alert_count = monitor_raw.count("🚨") + monitor_raw.count("⚠️")
    sec_ok = "critico" not in sec_state.lower()

    return render_template("_partials/kpi_cards.html",
                           positions=positions, bps=bps,
                           portfolio_total=portfolio_total, cash_free=cash_free,
                           alert_count=alert_count, sec_ok=sec_ok)


@app.route("/api/hunter-feed")
@login_required
def api_hunter_feed():
    today = datetime.now(ROME).strftime("%Y-%m-%d")
    opp_raw = gh_read(f"{KB}/opportunities/{today}.md") or ""
    opps = []
    current = {}
    for line in opp_raw.split("\n"):
        line = line.strip()
        if line == "---":
            if current.get("nome") or current.get("protocollo"):
                opps.append(current)
            current = {}
        elif ":" in line and not line.startswith("#"):
            k, _, v = line.partition(":")
            current[k.strip()] = v.strip()
    if current.get("nome") or current.get("protocollo"):
        opps.append(current)
    return render_template("_partials/hunter_feed.html", opps=opps, today=today)


# ── Legacy redirects ───────────────────────────────────────────────────────────

@app.route("/proposte")
@login_required
def proposte_redirect():
    return redirect(url_for("analista"))

@app.route("/portfolio")
@login_required
def portfolio_redirect():
    return redirect(url_for("vault"))

@app.route("/storico")
@login_required
def storico_redirect():
    return redirect(url_for("archivio"))

@app.route("/parcheggiati")
@login_required
def parcheggiati_redirect():
    return redirect(url_for("archivio"))

@app.route("/log")
@login_required
def log_redirect():
    return redirect(url_for("monitor"))


if __name__ == "__main__":
    port = int(os.environ.get("DASHBOARD_PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=False)
