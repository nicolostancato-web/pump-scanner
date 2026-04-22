#!/usr/bin/env python3
"""
The Wolf of Italy — Multi-Agent Orchestrator v3
WAT Framework: Workflows + Agent + Tools

5-stage execution:
  Stage 0 (sequential): CEO reads previous handoff, writes cycle plan
  Stage 1 (parallel):   RESEARCH-CRYPTO-1, RESEARCH-AI-1, RESEARCH-MARKET-1
  Stage 2 (sequential): CEO selects opportunities → execution_queue + decision_log
  Stage 3 (parallel):   EXECUTION-1, FINANCE-1, SECURITY-1
  Stage 4 (sequential): QUALITY-CONTROL-1 audits all Stage 3 output
  Stage 5 (sequential): CEO closes cycle → meeting_notes + handoff

Active agents: 8
Set AUTO_PAUSE_CRON=true to disable Railway cron after this run.
"""

import asyncio
import json
import os
import base64
from datetime import datetime
from pathlib import Path

import httpx
import litellm
from dotenv import load_dotenv

from ceo_brain import stage0_task, stage2_task, stage5_task

load_dotenv()

GITHUB_TOKEN = os.environ["GITHUB_TOKEN"]
GITHUB_REPO = os.environ.get("GITHUB_REPO", "nicolostancato-web/pump-scanner")
RAILWAY_TOKEN = os.environ.get("RAILWAY_TOKEN", "")
RAILWAY_SERVICE_ID = os.environ.get("RAILWAY_SERVICE_ID", "b5cc8c34-10b5-4c33-b4b9-82c71749a70c")
AUTO_PAUSE_CRON = os.environ.get("AUTO_PAUSE_CRON", "false").lower() == "true"
DATE = datetime.now().strftime("%Y-%m-%d")

MODEL = os.environ.get("LLM_MODEL", "deepseek/deepseek-chat")

litellm.drop_params = True

# ── TOOLS ──────────────────────────────────────────────────────────────────

async def coingecko_trending() -> dict:
    async with httpx.AsyncClient(timeout=20) as http:
        r = await http.get("https://api.coingecko.com/api/v3/search/trending")
        r.raise_for_status()
        return r.json()

async def coingecko_markets(limit: int = 20) -> list:
    async with httpx.AsyncClient(timeout=20) as http:
        url = f"https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page={min(limit,50)}&price_change_percentage=24h"
        r = await http.get(url)
        r.raise_for_status()
        return r.json()

async def fetch_url(url: str) -> str:
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as http:
        r = await http.get(url, headers={"User-Agent": "WolfOfItaly-Research/1.0"})
        r.raise_for_status()
        return r.text[:8000]

async def github_save(path: str, content: str, message: str) -> dict:
    encoded = base64.b64encode(content.encode("utf-8")).decode("utf-8")
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
    }
    async with httpx.AsyncClient(timeout=20) as http:
        existing = await http.get(
            f"https://api.github.com/repos/{GITHUB_REPO}/contents/{path}",
            headers=headers,
        )
        body = {"message": message, "content": encoded}
        if existing.status_code == 200:
            body["sha"] = existing.json()["sha"]
        r = await http.put(
            f"https://api.github.com/repos/{GITHUB_REPO}/contents/{path}",
            json=body,
            headers=headers,
        )
        return {"status": r.status_code, "path": path, "ok": r.status_code in (200, 201)}

TOOL_REGISTRY = {
    "coingecko_trending": coingecko_trending,
    "coingecko_markets": coingecko_markets,
    "fetch_url": fetch_url,
    "github_save": github_save,
}

TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "coingecko_trending",
            "description": "Fetch top trending cryptocurrencies from CoinGecko.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "coingecko_markets",
            "description": "Fetch top cryptocurrencies by volume with 24h price change.",
            "parameters": {
                "type": "object",
                "properties": {"limit": {"type": "integer", "default": 20}},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "fetch_url",
            "description": "Fetch content from any public URL.",
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
            "description": "Save a file to the GitHub repository. Creates or updates the file.",
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
]

# ── CEO SYSTEM PROMPT ──────────────────────────────────────────────────────

def load_ceo_system() -> str:
    claude_md = Path(__file__).parent / "CLAUDE.md"
    return claude_md.read_text() if claude_md.exists() else ""

CEO_SYSTEM = load_ceo_system()

# ── AGENT RUNNER ───────────────────────────────────────────────────────────

async def run_agent(name: str, task: str, stagger: int = 0) -> dict:
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

                if fn_name == "github_save" and isinstance(result, dict) and result.get("ok"):
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
    mutation serviceInstanceUpdate($input: ServiceInstanceUpdateInput!) {
      serviceInstanceUpdate(input: $input)
    }
    """
    variables = {"input": {"serviceId": RAILWAY_SERVICE_ID, "cronSchedule": ""}}
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

# ── WORKFLOW LOADER ────────────────────────────────────────────────────────

def load_workflow(filename: str) -> str:
    path = Path(__file__).parent / "workflows" / filename
    return path.read_text() if path.exists() else ""

# ── AGENT TASKS ────────────────────────────────────────────────────────────

KB = "the-wolf-of-italy/knowledge_base"
NOTES = "the-wolf-of-italy/team-notes"

STAGE1_AGENTS = [
    {
        "name": "RESEARCH-CRYPTO-1",
        "task": f"""You are RESEARCH-CRYPTO-1. Date: {DATE}.

{load_workflow("research_crypto.md")}

Execute now. Save BOTH files:
1. {KB}/opportunities/crypto-{DATE}.md — opportunity schemas (max 3, with id field)
2. {NOTES}/RESEARCH-CRYPTO-1/{DATE}/raw_notes.md — full raw data

Start with coingecko_trending, then coingecko_markets. Max 3 tool calls before saving.""",
    },
    {
        "name": "RESEARCH-AI-1",
        "task": f"""You are RESEARCH-AI-1. Date: {DATE}.

{load_workflow("research_ai.md")}

Execute now. Make at most 4 fetch_url calls total. Save BOTH files:
1. {KB}/opportunities/ai-{DATE}.md — opportunity schemas (max 3, with id field)
2. {NOTES}/RESEARCH-AI-1/{DATE}/raw_notes.md — full analysis

Start with HackerNews topstories, then 3 story details max. Then save immediately.""",
    },
    {
        "name": "RESEARCH-MARKET-1",
        "task": f"""You are RESEARCH-MARKET-1. Date: {DATE}.

{load_workflow("research_market.md")}

Execute now. Make at most 5 fetch_url calls total. Save BOTH files:
1. {KB}/opportunities/market-{DATE}.md — signal schemas (max 3, with id field)
2. {NOTES}/RESEARCH-MARKET-1/{DATE}/raw_notes.md — full analysis

Start with HackerNews, then 3 story details, then DeFiLlama. Then save immediately.""",
    },
]

STAGE3_AGENTS = [
    {
        "name": "EXECUTION-1",
        "task": f"""You are EXECUTION-1. Date: {DATE}.

{load_workflow("execution.md")}

Execute now. Read the execution queue first (max 3 fetch_url calls total before executing).
Save BOTH files:
1. {KB}/execution_results/{DATE}-execution.md — test result schema
2. {NOTES}/EXECUTION-1/{DATE}/execution_log.md — full log

A VALID test must test a business hypothesis, not just check if an API works.
After reading the queue, execute ONE test and save results immediately.""",
    },
    {
        "name": "FINANCE-1",
        "task": f"""You are FINANCE-1. Date: {DATE}.

{load_workflow("finance.md")}

Execute now. Read execution_results first (1 fetch_url call max), then save:
1. {KB}/finance_review/{DATE}-cfo_note.md — CFO note
2. {NOTES}/FINANCE-1/{DATE}/cfo_note.md — same content

Commit: "FINANCE-1: CFO note {DATE}"
Known costs: n8n €32 + Railway €14 + DeepSeek ~€1 = ~€47/month total.""",
    },
    {
        "name": "SECURITY-1",
        "task": f"""You are SECURITY-1. Date: {DATE}.

{load_workflow("security.md")}

Execute now. Calculate JWT days, check Solana wallet. Save BOTH files:
1. {KB}/security_audits/{DATE}-security.md — security schema
2. {NOTES}/SECURITY-1/{DATE}/security_note.md — same content

Only report REAL risks that exist today.""",
    },
]

STAGE4_QC_TASK = f"""You are QUALITY-CONTROL-1. Date: {DATE}.

{load_workflow("quality_control.md")}

Execute now. Check ALL agents: RESEARCH-CRYPTO-1, RESEARCH-AI-1, RESEARCH-MARKET-1, EXECUTION-1, FINANCE-1, SECURITY-1.
Also check knowledge_base flow: opportunities/, execution_queue/, execution_results/, finance_review/, security_audits/.

Save BOTH files:
1. {KB}/qc_audits/{DATE}-audit.md — audit table + flow status
2. {NOTES}/QUALITY-CONTROL-1/{DATE}/audit.md — same content

Scoring is PASS / PARTIAL / FAIL. An all-PASS audit when files are weak = QC itself is FAIL.
Be honest."""

# ── MAIN ───────────────────────────────────────────────────────────────────

async def main():
    print(f"\n{'='*60}")
    print(f"The Wolf of Italy — Orchestrator v3")
    print(f"Date: {DATE} | Model: {MODEL}")
    print(f"Flow: Stage0→Research→CEO→Exec+Finance+Security→QC→CEO-Close")
    if AUTO_PAUSE_CRON:
        print(f"AUTO_PAUSE_CRON=true — cron will be disabled after this run")
    print(f"{'='*60}\n")

    all_results = []

    # ── STAGE 0: CEO reads previous handoff ───────────────────────────────
    print("STAGE 0 — CEO reads previous handoff")
    s0_result = await run_agent("CEO-ORCHESTRATOR", stage0_task())
    all_results.append(s0_result)

    # ── STAGE 1: Research (parallel, staggered 8s) ─────────────────────────
    print("\nSTAGE 1 — Research agents (parallel)")
    stage1_tasks = [
        run_agent(a["name"], a["task"], stagger=i * 8)
        for i, a in enumerate(STAGE1_AGENTS)
    ]
    stage1_results = await asyncio.gather(*stage1_tasks, return_exceptions=True)
    all_results.extend(stage1_results)

    # ── STAGE 2: CEO selects opportunities ────────────────────────────────
    print("\nSTAGE 2 — CEO selects opportunities")
    s2_result = await run_agent("CEO-ORCHESTRATOR", stage2_task())
    all_results.append(s2_result)

    # ── STAGE 3: Execution + Finance + Security (parallel) ────────────────
    print("\nSTAGE 3 — Execution, Finance, Security (parallel)")
    stage3_tasks = [
        run_agent(a["name"], a["task"], stagger=i * 8)
        for i, a in enumerate(STAGE3_AGENTS)
    ]
    stage3_results = await asyncio.gather(*stage3_tasks, return_exceptions=True)
    all_results.extend(stage3_results)

    # ── STAGE 4: QC audit (sequential — reads Stage 3 output) ─────────────
    print("\nSTAGE 4 — Quality Control audit")
    s4_result = await run_agent("QUALITY-CONTROL-1", STAGE4_QC_TASK)
    all_results.append(s4_result)

    # ── STAGE 5: CEO closes cycle ─────────────────────────────────────────
    print("\nSTAGE 5 — CEO closes cycle (meeting notes + handoff)")
    s5_result = await run_agent("CEO-ORCHESTRATOR", stage5_task())
    all_results.append(s5_result)

    # ── SUMMARY ───────────────────────────────────────────────────────────
    print(f"\n{'─'*40}")
    print("SUMMARY:")
    ok = 0
    for r in all_results:
        if isinstance(r, Exception):
            print(f"  ❌ ERROR: {str(r)[:100]}")
        else:
            status = "✅" if r["status"] == "ok" else "⚠️"
            if r["status"] == "ok":
                ok += 1
            print(f"  {status} {r['name']}: {r['status']}")

    print(f"\n{ok}/{len(all_results)} agents completed — {DATE}")

    # ── AUTO PAUSE CRON ───────────────────────────────────────────────────
    if AUTO_PAUSE_CRON:
        print("\nPausing Railway cron...")
        await pause_railway_cron()

if __name__ == "__main__":
    asyncio.run(main())
