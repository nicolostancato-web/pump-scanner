"""
Wolf of Italy v4 — Dashboard Web
Flask + HTMX. 6 tabs. Italian UI. Auto-refresh ogni 60s.
"""

import base64
import json
import os
from datetime import datetime
from functools import wraps
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
from flask import Flask, abort, redirect, render_template, request, session, url_for

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET", "wolf-secret-change-me")

DASHBOARD_PASSWORD = os.environ.get("DASHBOARD_PASSWORD", "wolf2024")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
REPO = os.environ.get("GITHUB_REPO", "nicolostancato-web/pump-scanner")
KB = "the-wolf-of-italy/knowledge_base"
ROME = ZoneInfo("Europe/Rome")
BASE_URL = f"https://api.github.com/repos/{REPO}/contents"

# ── GitHub helpers ────────────────────────────────────────────────────────────

def _gh_headers():
    return {"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"}


def gh_read(path: str) -> str | None:
    """Read a file from GitHub. Returns decoded text or None."""
    try:
        r = httpx.get(f"{BASE_URL}/{path}", headers=_gh_headers(), timeout=10)
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return base64.b64decode(r.json()["content"]).decode("utf-8")
    except Exception:
        return None


def gh_list(path: str) -> list[dict]:
    """List files in a GitHub folder."""
    try:
        r = httpx.get(f"{BASE_URL}/{path}", headers=_gh_headers(), timeout=10)
        if r.status_code == 404:
            return []
        r.raise_for_status()
        return [f for f in r.json() if f["type"] == "file" and not f["name"].startswith(".")]
    except Exception:
        return []


def gh_write(path: str, content: str, message: str) -> bool:
    """Write a file to GitHub. Returns True on success."""
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


# ── Auth ──────────────────────────────────────────────────────────────────────

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("logged_in"):
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated


@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        if request.form.get("password") == DASHBOARD_PASSWORD:
            session["logged_in"] = True
            return redirect(url_for("proposals"))
        error = "Password errata"
    return render_template("login.html", error=error)


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/health")
def health():
    return {"status": "ok", "time": datetime.now(ROME).isoformat()}

# ── Parsing helpers ───────────────────────────────────────────────────────────

def parse_pending_decisions(content: str) -> list[dict]:
    """Parse pending_decisions.md into list of BP dicts."""
    if not content:
        return []
    bps = []
    current = {}
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
    """Parse active_positions.md into list of position dicts."""
    if not content:
        return []
    positions = []
    current = {}
    for line in content.split("\n"):
        if line.startswith("## BP-"):
            if current:
                positions.append(current)
            current = {"name": line.lstrip("# ").strip()}
        elif ":" in line and current and not line.startswith("#"):
            key, _, val = line.partition(":")
            current[key.strip()] = val.strip()
    if current:
        positions.append(current)
    return positions


def parse_parked(files: list[dict]) -> list[dict]:
    """Read all parked/ BP files."""
    items = []
    for f in sorted(files, key=lambda x: x["name"]):
        content = gh_read(f["path"])
        if content:
            bp = {"id": f["name"].replace(".md", ""), "raw": content}
            for line in content.split("\n")[:20]:
                if ":" in line and not line.startswith("#"):
                    k, _, v = line.partition(":")
                    bp[k.strip()] = v.strip()
            items.append(bp)
    return items


# ── TAB 1 — Proposte ─────────────────────────────────────────────────────────

@app.route("/")
@app.route("/proposte")
@login_required
def proposals():
    today = datetime.now(ROME).strftime("%Y-%m-%d")
    pending_raw = gh_read(f"{KB}/analysis/pending_decisions.md")
    bps = parse_pending_decisions(pending_raw)[:5]
    return render_template("proposals.html", bps=bps, today=today, active_tab="proposte")


@app.route("/proposte/decision", methods=["POST"])
@login_required
def make_decision():
    """Write decision to decisions_queue.md."""
    bp_id = request.form.get("bp_id", "")
    decision = request.form.get("decision", "")
    notes = request.form.get("notes", "")
    if not bp_id or decision not in ("ACCEPTED", "REJECTED", "PARKED"):
        abort(400)

    now = datetime.now(ROME).isoformat()
    new_entry = f"\nbp_id: {bp_id}\ndecision: {decision}\ntimestamp: {now}\nnotes: {notes}\n---\n"

    existing = gh_read(f"{KB}/analysis/decisions_queue.md") or ""
    gh_write(f"{KB}/analysis/decisions_queue.md", existing + new_entry, f"Dashboard: {decision} {bp_id}")
    return redirect(url_for("proposals"))


@app.route("/proposte/conferma_deploy", methods=["POST"])
@login_required
def confirm_deploy():
    """Mark a pending_deployment as DEPLOYMENT_CONFIRMED."""
    bp_id = request.form.get("bp_id", "")
    if not bp_id:
        abort(400)
    content = gh_read(f"{KB}/portfolio/pending_deployment.md") or ""
    updated = content.replace(
        f"BP_ID: {bp_id}\nStato: PENDING_DEPLOYMENT",
        f"BP_ID: {bp_id}\nStato: DEPLOYMENT_CONFIRMED"
    )
    gh_write(f"{KB}/portfolio/pending_deployment.md", updated, f"Dashboard: deploy confermato {bp_id}")
    return redirect(url_for("portfolio"))


# ── TAB 2 — Portfolio ─────────────────────────────────────────────────────────

@app.route("/portfolio")
@login_required
def portfolio():
    today = datetime.now(ROME).strftime("%Y-%m-%d")
    daily_report = gh_read(f"{KB}/portfolio/daily_report.md") or "Nessun report disponibile ancora."
    active_raw = gh_read(f"{KB}/portfolio/active_positions.md")
    positions = parse_active_positions(active_raw)
    pending_raw = gh_read(f"{KB}/portfolio/pending_deployment.md") or ""
    return render_template("portfolio.html",
                           daily_report=daily_report,
                           positions=positions,
                           pending_raw=pending_raw,
                           today=today,
                           active_tab="portfolio")


# ── TAB 3 — Parcheggiati ─────────────────────────────────────────────────────

@app.route("/parcheggiati")
@login_required
def parked():
    files = gh_list(f"{KB}/parked")
    items = parse_parked(files)
    return render_template("parked.html", items=items, active_tab="parcheggiati")


@app.route("/parcheggiati/riattiva", methods=["POST"])
@login_required
def reactivate_parked():
    """Move parked BP back to pending_decisions (send to TAB 1)."""
    bp_id = request.form.get("bp_id", "")
    if not bp_id:
        abort(400)
    content = gh_read(f"{KB}/parked/{bp_id}.md") or ""
    # Add to pending_decisions with tipo: parked
    pending = gh_read(f"{KB}/analysis/pending_decisions.md") or ""
    now = datetime.now(ROME).isoformat()
    entry = f"\n---\nid_bp: {bp_id}\ntipo: parked\ntimestamp_proposto: {now}\npriority: medium\n---\n"
    gh_write(f"{KB}/analysis/pending_decisions.md", pending + entry, f"Dashboard: riattiva {bp_id}")
    return redirect(url_for("parked"))


# ── TAB 4 — Storico ───────────────────────────────────────────────────────────

@app.route("/storico")
@login_required
def history():
    closed = gh_read(f"{KB}/portfolio/closed_positions.md") or "Nessuna posizione chiusa."
    archived_files = gh_list(f"{KB}/archived")
    archived = []
    for f in archived_files[:20]:
        content = gh_read(f["path"])
        if content:
            archived.append({"name": f["name"], "content": content[:500]})
    seen = gh_read(f"{KB}/hunter_memory/seen_protocols.md") or "Nessun protocollo tracciato ancora."
    return render_template("history.html",
                           closed=closed,
                           archived=archived,
                           seen=seen,
                           active_tab="storico")


# ── TAB 5 — Log Agenti ────────────────────────────────────────────────────────

@app.route("/log")
@login_required
def agents_log():
    today = datetime.now(ROME).strftime("%Y-%m-%d")
    opportunities = gh_read(f"{KB}/opportunities/{today}.md") or "Nessuna opportunità oggi."
    pending_dec = gh_read(f"{KB}/analysis/pending_decisions.md") or "Nessuna proposta in attesa."
    daily_report = gh_read(f"{KB}/portfolio/daily_report.md") or "Daily report non ancora generato."
    monitor_log = gh_read(f"{KB}/monitor/{today}.md") or "Monitor non ancora eseguito oggi."
    sec_state = gh_read(f"{KB}/security_state.md") or "Security state non disponibile."
    sec_alert = gh_read(f"{KB}/security_alerts/{today}.md")

    return render_template("agents_log.html",
                           opportunities=opportunities,
                           pending_dec=pending_dec,
                           daily_report=daily_report,
                           monitor_log=monitor_log,
                           sec_state=sec_state,
                           sec_alert=sec_alert,
                           today=today,
                           active_tab="log")


# ── TAB 6 — Impostazioni ──────────────────────────────────────────────────────

@app.route("/impostazioni")
@login_required
def settings():
    hunter_prompt = gh_read("the-wolf-of-italy/v4/prompts/hunter.md") or ""
    return render_template("settings.html",
                           hunter_prompt=hunter_prompt,
                           active_tab="impostazioni")


# ── HTMX partial refresh ─────────────────────────────────────────────────────

@app.route("/refresh/proposte")
@login_required
def refresh_proposals():
    today = datetime.now(ROME).strftime("%Y-%m-%d")
    pending_raw = gh_read(f"{KB}/analysis/pending_decisions.md")
    bps = parse_pending_decisions(pending_raw)[:5]
    return render_template("_partials/bp_list.html", bps=bps, today=today)


@app.route("/refresh/portfolio")
@login_required
def refresh_portfolio():
    active_raw = gh_read(f"{KB}/portfolio/active_positions.md")
    positions = parse_active_positions(active_raw)
    return render_template("_partials/positions_list.html", positions=positions)


if __name__ == "__main__":
    port = int(os.environ.get("DASHBOARD_PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=False)
