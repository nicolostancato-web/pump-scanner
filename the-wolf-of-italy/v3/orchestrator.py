#!/usr/bin/env python3
"""
The Wolf of Italy — Orchestrator v3-airdrop
Solana Airdrop Farming System

5-stage execution:
  Stage 0 (sequential): CEO reads handoff → writes cycle plan
  Stage 1 (parallel):   AIRDROP-HUNTER-1 + ELIGIBILITY-TRACKER-1
  Stage 2 (sequential): CEO decides if action needed → writes decision_log
  Stage 3 (sequential): ACTION-PROPOSER-1 (only if CEO decided action) + CFO-SECURITY-1 parallel
  Stage 4 (parallel):   nothing — CFO already ran in stage 3
  Stage 5 (sequential): CEO closes cycle → meeting_notes + handoff

Set AUTO_PAUSE_CRON=true to disable Railway cron after this run.
"""

import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path

import httpx
import litellm
from dotenv import load_dotenv

from ceo_brain import stage0_task, stage2_task, stage5_task
from agents.airdrop_hunter import task as airdrop_hunter_task
from agents.eligibility_tracker import task as eligibility_tracker_task
from agents.action_proposer import task as action_proposer_task
from agents.cfo_security import task as cfo_security_task
from tools.solana_reader import get_sol_balance, get_token_accounts, get_recent_transactions
from tools.email_sender import send_proposal_email
from tools.github_memory import kb_write

load_dotenv(dotenv_path=Path(__file__).parent / ".env")

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "nicolostancato-web/pump-scanner")
RAILWAY_TOKEN = os.environ.get("RAILWAY_TOKEN", "")
RAILWAY_SERVICE_ID = os.environ.get("RAILWAY_SERVICE_ID", "b5cc8c34-10b5-4c33-b4b9-82c71749a70c")
AUTO_PAUSE_CRON = os.environ.get("AUTO_PAUSE_CRON", "false").lower() == "true"

DATE = datetime.now().strftime("%Y-%m-%d")
MODEL = os.environ.get("LLM_MODEL", "deepseek/deepseek-chat")

litellm.drop_params = True

# ── TOOL REGISTRY ─────────────────────────────────────────────────────────

async def fetch_url(url: str) -> str:
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as http:
        r = await http.get(url, headers={"User-Agent": "WolfOfItaly/3.0"})
        r.raise_for_status()
        return r.text[:8000]

async def github_save(path: str, content: str, message: str) -> dict:
    return await kb_write(path, content, message)

TOOL_REGISTRY = {
    "fetch_url": fetch_url,
    "github_save": github_save,
    "get_sol_balance": get_sol_balance,
    "get_token_accounts": get_token_accounts,
    "get_recent_transactions": get_recent_transactions,
    "send_proposal_email": send_proposal_email,
}

TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "fetch_url",
            "description": "Fetch content from any public URL (max 8000 chars returned).",
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
            "description": "Save a file to the knowledge_base on GitHub. Creates or updates.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Full path in repo, e.g. the-wolf-of-italy/knowledge_base/..."},
                    "content": {"type": "string"},
                    "message": {"type": "string", "description": "Git commit message"},
                },
                "required": ["path", "content", "message"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_sol_balance",
            "description": "Get SOL balance of a Solana wallet via public RPC. Returns lamports and SOL.",
            "parameters": {
                "type": "object",
                "properties": {"wallet": {"type": "string", "description": "Solana public key"}},
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
            "description": "Get recent transaction signatures for a Solana wallet to verify on-chain activity.",
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
            "description": "Send an action proposal email to the founder. Use only once per cycle.",
            "parameters": {
                "type": "object",
                "properties": {
                    "subject": {"type": "string", "description": "Email subject (without [Wolf] prefix, that's added automatically)"},
                    "body": {"type": "string", "description": "Full proposal text"},
                },
                "required": ["subject", "body"],
            },
        },
    },
]

# ── CEO SYSTEM PROMPT ──────────────────────────────────────────────────────

def load_ceo_system() -> str:
    p = Path(__file__).parent / "prompts" / "ceo.md"
    return p.read_text() if p.exists() else ""

CEO_SYSTEM = load_ceo_system()

# ── AGENT RUNNER ───────────────────────────────────────────────────────────

async def run_agent(name: str, task: str, stagger: int = 0, save_all: bool = False) -> dict:
    """save_all=True disables early-exit on github_save (use for agents that write multiple files)."""
    if stagger:
        await asyncio.sleep(stagger)

    system = CEO_SYSTEM + f"\n\nYou are acting as {name}. Today's date: {DATE}."
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": task},
    ]

    print(f"  [{name}] starting...")

    for iteration in range(20):
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
                if ("rate_limit" in err or "429" in err or "resource_exhausted" in err) and attempt < 2:
                    wait = 60 * (attempt + 1)
                    print(f"  [{name}] rate limit — waiting {wait}s...")
                    await asyncio.sleep(wait)
                else:
                    raise

        choice = response.choices[0]
        finish_reason = choice.finish_reason

        if finish_reason in ("stop", "end_turn", "length"):
            text = choice.message.content or ""
            print(f"  [{name}] done after {iteration+1} steps")
            return {"name": name, "status": "ok", "output": text}

        if finish_reason == "tool_calls":
            tool_calls = choice.message.tool_calls or []
            messages.append({
                "role": "assistant",
                "content": choice.message.content,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                    }
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
                print(f"  [{name}] → {fn_name}({list(fn_args.keys())})")
                try:
                    result = await fn(**fn_args) if fn else f"Tool {fn_name} not found"
                except Exception as e:
                    result = f"Error calling {fn_name}: {e}"

                if fn_name == "github_save" and isinstance(result, dict) and result.get("ok") and not save_all:
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": json.dumps(result),
                    })
                    print(f"  [{name}] done after {iteration+1} steps (saved)")
                    return {"name": name, "status": "ok", "output": f"Saved: {result['path']}"}

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(result) if not isinstance(result, str) else result,
                })

    return {"name": name, "status": "timeout", "output": "Max iterations reached"}

# ── RAILWAY CRON PAUSE ─────────────────────────────────────────────────────

async def pause_railway_cron():
    if not RAILWAY_TOKEN:
        print("  [CRON-PAUSE] RAILWAY_TOKEN not set — skipping")
        return
    query = """
    mutation serviceInstanceUpdate($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
      serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
    }
    """
    variables = {
        "serviceId": RAILWAY_SERVICE_ID,
        "environmentId": os.environ.get("RAILWAY_ENV_ID", "b2dc4bc6-de87-4324-940d-cdaecf9698ae"),
        "input": {"cronSchedule": ""},
    }
    async with httpx.AsyncClient(timeout=20) as http:
        r = await http.post(
            "https://backboard.railway.app/graphql/v2",
            json={"query": query, "variables": variables},
            headers={"Authorization": f"Bearer {RAILWAY_TOKEN}", "Content-Type": "application/json"},
        )
        if r.status_code == 200 and not r.json().get("errors"):
            print("  [CRON-PAUSE] Railway cron disabled — re-enable manually when ready")
        else:
            print(f"  [CRON-PAUSE] Failed: {r.status_code} {r.text[:200]}")

# ── MAIN ───────────────────────────────────────────────────────────────────

async def main():
    print(f"\n{'='*60}")
    print(f"The Wolf of Italy — Orchestrator v3-airdrop")
    print(f"Date: {DATE} | Model: {MODEL}")
    print(f"Flow: Handoff→Research→Decision→Action+CFO→CEO-Close")
    if AUTO_PAUSE_CRON:
        print(f"AUTO_PAUSE_CRON=true — cron will be disabled after this run")
    print(f"{'='*60}\n")

    all_results = []

    # ── STAGE 0: CEO reads previous handoff ───────────────────────────────
    print("STAGE 0 — CEO reads handoff")
    s0 = await run_agent("CEO-ORCHESTRATOR", stage0_task())
    all_results.append(s0)

    # ── STAGE 1: Research (parallel) ──────────────────────────────────────
    print("\nSTAGE 1 — Research (parallel)")
    stage1_results = await asyncio.gather(
        run_agent("AIRDROP-HUNTER-1", airdrop_hunter_task()),
        run_agent("ELIGIBILITY-TRACKER-1", eligibility_tracker_task(), stagger=8),
        return_exceptions=True,
    )
    all_results.extend(stage1_results)

    # ── STAGE 2: CEO decides ───────────────────────────────────────────────
    print("\nSTAGE 2 — CEO decision")
    s2 = await run_agent("CEO-ORCHESTRATOR", stage2_task())
    all_results.append(s2)

    # ── STAGE 3: Action Proposer + CFO-Security (parallel) ────────────────
    print("\nSTAGE 3 — Action Proposer + CFO-Security (parallel)")
    stage3_results = await asyncio.gather(
        run_agent("ACTION-PROPOSER-1", action_proposer_task()),
        run_agent("CFO-SECURITY-1", cfo_security_task(), stagger=8),
        return_exceptions=True,
    )
    all_results.extend(stage3_results)

    # ── STAGE 5: CEO closes cycle — needs save_all=True to write both meeting_notes + handoff
    print("\nSTAGE 5 — CEO closes cycle")
    s5 = await run_agent("CEO-ORCHESTRATOR", stage5_task(), save_all=True)
    all_results.append(s5)

    # ── SUMMARY ───────────────────────────────────────────────────────────
    print(f"\n{'─'*40}")
    print("SUMMARY:")
    ok = 0
    for r in all_results:
        if isinstance(r, Exception):
            print(f"  ❌ ERROR: {str(r)[:100]}")
        else:
            icon = "✅" if r["status"] == "ok" else "⚠️"
            if r["status"] == "ok":
                ok += 1
            print(f"  {icon} {r['name']}: {r['status']}")

    print(f"\n{ok}/{len(all_results)} agents completed — {DATE}")

    # ── AUTO PAUSE CRON ───────────────────────────────────────────────────
    if AUTO_PAUSE_CRON:
        print("\nPausing Railway cron...")
        await pause_railway_cron()

if __name__ == "__main__":
    asyncio.run(main())
