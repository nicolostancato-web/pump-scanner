#!/usr/bin/env python3
"""
The Wolf of Italy — Orchestrator v4
5 specialized agents + async scheduling.

Agents and intervals:
  HUNTER    — every 30 min (finds new opportunities)
  ANALISTA  — every 5 min (processes dashboard decisions)
  CFO       — every 4 hours (updates portfolio + prices)
  MONITOR   — once daily at 07:00 Rome (protocol health)
  SECURITY  — every 1 hour (infra check)
  RESET     — once daily at 22:00 Rome (end-of-day cleanup)

All agents are long-running asyncio loops. No external cron needed.
"""

import asyncio
import json
import logging
import os
import threading
from datetime import datetime, time as dtime
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
import litellm
from dotenv import load_dotenv

from agents.hunter import task as hunter_task
from agents.analista import task as analista_task
from agents.cfo import task as cfo_task
from agents.monitor import task as monitor_task
from agents.security import task as security_task
from tools.solana_reader import get_sol_balance, get_token_accounts, get_recent_transactions
from tools.email_sender import send_proposal_email, send_critical_alert
from tools.github_memory import kb_write
from tools.web_scraper import fetch_text, fetch_json

load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)

MODEL = os.environ.get("LLM_MODEL", "deepseek/deepseek-chat")
ROME = ZoneInfo("Europe/Rome")

litellm.drop_params = True
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
log = logging.getLogger("wolf-v4")

# ── TOOL REGISTRY ─────────────────────────────────────────────────────────────

async def fetch_url(url: str) -> str:
    return await fetch_text(url)

async def github_save(path: str, content: str, message: str) -> dict:
    return await kb_write(path, content, message)

TOOL_REGISTRY = {
    "fetch_url": fetch_url,
    "github_save": github_save,
    "get_sol_balance": get_sol_balance,
    "get_token_accounts": get_token_accounts,
    "get_recent_transactions": get_recent_transactions,
    "send_proposal_email": send_proposal_email,
    "send_critical_alert": send_critical_alert,
}

TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "fetch_url",
            "description": "Fetch content from any public URL. Returns text/HTML stripped to plain text (max 8000 chars).",
            "parameters": {
                "type": "object",
                "properties": {"url": {"type": "string"}},
                "required": ["url"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "github_save",
            "description": "Save or update a file in the knowledge_base on GitHub.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "content": {"type": "string"},
                    "message": {"type": "string"},
                },
                "required": ["path", "content", "message"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_sol_balance",
            "description": "Get SOL balance of a Solana wallet.",
            "parameters": {
                "type": "object",
                "properties": {"wallet": {"type": "string"}},
                "required": ["wallet"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_token_accounts",
            "description": "Get all SPL token accounts and balances for a Solana wallet.",
            "parameters": {
                "type": "object",
                "properties": {"wallet": {"type": "string"}},
                "required": ["wallet"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_recent_transactions",
            "description": "Get recent transaction signatures for a Solana wallet.",
            "parameters": {
                "type": "object",
                "properties": {
                    "wallet": {"type": "string"},
                    "limit": {"type": "integer", "default": 10},
                },
                "required": ["wallet"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_proposal_email",
            "description": "Send Investment Alert email to founder.",
            "parameters": {
                "type": "object",
                "properties": {
                    "subject": {"type": "string"},
                    "body": {"type": "string"},
                    "guide_url": {"type": "string"},
                },
                "required": ["subject", "body"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_critical_alert",
            "description": "Send critical security/monitor alert email. Use only for real emergencies.",
            "parameters": {
                "type": "object",
                "properties": {
                    "subject": {"type": "string"},
                    "body": {"type": "string"},
                },
                "required": ["subject", "body"],
            },
        },
    },
]

SYSTEM_PROMPT = """You are an agent in the Wolf of Italy automated trading system.
You have access to tools to fetch web content, read/write the knowledge base on GitHub,
check Solana blockchain data, and send critical alerts.
Always produce real output based on data fetched. No padding, no invented numbers.
End every run with an AUDIT line: what you fetched, what you saved."""

# ── AGENT RUNNER ──────────────────────────────────────────────────────────────

async def run_agent(name: str, task_str: str, save_all: bool = False) -> dict:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT + f"\n\nYou are acting as {name}. Today: {datetime.now(ROME).strftime('%Y-%m-%d %H:%M')} Rome."},
        {"role": "user", "content": task_str},
    ]
    log.info(f"[{name}] starting")

    for iteration in range(25):
        for attempt in range(3):
            try:
                response = await litellm.acompletion(
                    model=MODEL,
                    messages=messages,
                    tools=TOOLS_SCHEMA,
                    tool_choice="auto",
                    max_tokens=4096,
                )
                break
            except Exception as e:
                err = str(e).lower()
                retryable = any(x in err for x in ("rate_limit", "429", "504", "502", "timeout", "gateway", "resource_exhausted"))
                if retryable and attempt < 2:
                    wait = 30 * (attempt + 1)
                    log.warning(f"[{name}] transient error ({type(e).__name__}) — retry in {wait}s")
                    await asyncio.sleep(wait)
                else:
                    raise

        choice = response.choices[0]
        finish = choice.finish_reason

        if finish in ("stop", "end_turn", "length"):
            text = choice.message.content or ""
            log.info(f"[{name}] done after {iteration + 1} steps")
            return {"name": name, "status": "ok", "output": text}

        if finish == "tool_calls":
            tool_calls = choice.message.tool_calls or []
            messages.append({
                "role": "assistant",
                "content": choice.message.content,
                "tool_calls": [
                    {"id": tc.id, "type": "function", "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                    for tc in tool_calls
                ],
            })

            for tc in tool_calls:
                fn_name = tc.function.name
                try:
                    fn_args = json.loads(tc.function.arguments or "{}")
                except json.JSONDecodeError:
                    fn_args = {}
                fn = TOOL_REGISTRY.get(fn_name)
                log.info(f"[{name}] → {fn_name}({list(fn_args.keys())})")
                try:
                    result = await fn(**fn_args) if fn else f"Tool {fn_name} not found"
                except Exception as e:
                    result = f"Error in {fn_name}: {e}"

                if fn_name == "github_save" and isinstance(result, dict) and result.get("ok") and not save_all:
                    messages.append({"role": "tool", "tool_call_id": tc.id, "content": json.dumps(result)})
                    log.info(f"[{name}] done after {iteration + 1} steps (saved)")
                    return {"name": name, "status": "ok", "output": f"Saved: {result['path']}"}

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(result) if not isinstance(result, str) else result,
                })

    return {"name": name, "status": "timeout", "output": "Max iterations reached"}

# ── SCHEDULER HELPERS ─────────────────────────────────────────────────────────

async def sleep_until(target_time: dtime) -> None:
    """Sleep until the next occurrence of target_time in Rome timezone."""
    now = datetime.now(ROME)
    target = now.replace(hour=target_time.hour, minute=target_time.minute, second=0, microsecond=0)
    if target <= now:
        target = target.replace(day=target.day + 1)
    delta = (target - now).total_seconds()
    log.info(f"Sleeping {delta/3600:.1f}h until {target_time}")
    await asyncio.sleep(delta)

# ── AGENT LOOPS ───────────────────────────────────────────────────────────────

async def hunter_loop():
    """Every 30 minutes."""
    while True:
        try:
            await run_agent("HUNTER", hunter_task(), save_all=True)
        except Exception as e:
            log.error(f"[HUNTER] crashed: {e}")
        await asyncio.sleep(30 * 60)


async def analista_loop():
    """Every 5 minutes."""
    while True:
        try:
            await run_agent("ANALISTA", analista_task())
        except Exception as e:
            log.error(f"[ANALISTA] crashed: {e}")
        await asyncio.sleep(5 * 60)


async def cfo_loop():
    """Every 4 hours. Generates daily_report at 07:00 Rome."""
    while True:
        now = datetime.now(ROME)
        is_morning = now.hour == 7
        try:
            await run_agent("CFO", cfo_task(daily_report=is_morning), save_all=is_morning)
        except Exception as e:
            log.error(f"[CFO] crashed: {e}")
        await asyncio.sleep(4 * 60 * 60)


async def monitor_loop():
    """Once daily at 07:00 Rome."""
    while True:
        await sleep_until(dtime(7, 0))
        try:
            await run_agent("MONITOR", monitor_task())
        except Exception as e:
            log.error(f"[MONITOR] crashed: {e}")
        await asyncio.sleep(60)  # small buffer before re-checking time


async def security_loop():
    """Every 1 hour."""
    while True:
        try:
            await run_agent("SECURITY", security_task())
        except Exception as e:
            log.error(f"[SECURITY] crashed: {e}")
        await asyncio.sleep(60 * 60)


async def reset_loop():
    """Daily at 22:00 Rome: move undecided BP to parked, clear opportunities."""
    while True:
        await sleep_until(dtime(22, 0))
        try:
            await run_agent("ANALISTA", analista_task(reset_mode=True))
        except Exception as e:
            log.error(f"[RESET] crashed: {e}")
        await asyncio.sleep(60)

# ── MAIN ──────────────────────────────────────────────────────────────────────

def _start_dashboard():
    """Run Flask dashboard in background thread (same process, same Railway service)."""
    import sys
    root = str(Path(__file__).parent)
    if root not in sys.path:
        sys.path.insert(0, root)
    from dashboard.app import app as flask_app
    port = int(os.environ.get("PORT", os.environ.get("DASHBOARD_PORT", 5000)))
    log.info(f"Dashboard starting on port {port} via waitress")
    try:
        from waitress import serve
        serve(flask_app, host="0.0.0.0", port=port, threads=4)
    except ImportError:
        # fallback: werkzeug dev server (no signal handlers in thread = OK for non-Linux)
        flask_app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False, threaded=True)


async def main():
    log.info("=" * 60)
    log.info("The Wolf of Italy — v4")
    log.info(f"Model: {MODEL} | Rome: {datetime.now(ROME).strftime('%Y-%m-%d %H:%M')}")
    log.info("Agents: HUNTER(30m) | ANALISTA(5m) | CFO(4h) | MONITOR(07:00) | SECURITY(1h) | RESET(22:00)")
    log.info("=" * 60)

    # Dashboard runs in background thread alongside asyncio loops
    dashboard_thread = threading.Thread(target=_start_dashboard, daemon=True)
    dashboard_thread.start()

    await asyncio.gather(
        hunter_loop(),
        analista_loop(),
        cfo_loop(),
        monitor_loop(),
        security_loop(),
        reset_loop(),
    )


if __name__ == "__main__":
    asyncio.run(main())
