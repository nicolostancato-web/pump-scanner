#!/usr/bin/env python3
"""
The Wolf of Italy — Multi-Agent Orchestrator
WAT Framework: Workflows + Agent + Tools

Runs all active team agents in parallel using free Gemini 2.0 Flash.
Each agent fetches real data and saves notes to GitHub.
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

load_dotenv()

GITHUB_TOKEN = os.environ["GITHUB_TOKEN"]
GITHUB_REPO = os.environ.get("GITHUB_REPO", "nicolostancato-web/pump-scanner")
DATE = datetime.now().strftime("%Y-%m-%d")

# Default: Groq free tier (6K req/day free, fast, tool calling)
# Override with LLM_MODEL env var:
#   "groq/llama-3.3-70b-versatile"          — free, good quality
#   "deepseek/deepseek-chat"                 — $0.002/run, best quality
#   "gemini/gemini-2.0-flash"                — Google free tier
#   "anthropic/claude-haiku-4-5-20251001"    — back to Anthropic
MODEL = os.environ.get("LLM_MODEL", "deepseek/deepseek-chat")

litellm.drop_params = True  # ignore unsupported params silently

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
        return r.text[:10000]

async def github_save(path: str, content: str, message: str) -> dict:
    encoded = base64.b64encode(content.encode("utf-8")).decode("utf-8")
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
    }
    async with httpx.AsyncClient(timeout=20) as http:
        # Check if file exists to get its SHA (required for updates)
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

# OpenAI-compatible tool schema (works with litellm → any provider)
TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "coingecko_trending",
            "description": "Fetch top trending cryptocurrencies from CoinGecko. Free, no API key needed.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "coingecko_markets",
            "description": "Fetch top cryptocurrencies by volume with 24h price change. Returns price, volume, % change.",
            "parameters": {
                "type": "object",
                "properties": {"limit": {"type": "integer", "description": "Number of coins to fetch (max 50)", "default": 20}},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "fetch_url",
            "description": "Fetch content from any public URL. Use for APIs, web pages, RSS feeds, JSON endpoints.",
            "parameters": {
                "type": "object",
                "properties": {"url": {"type": "string", "description": "The URL to fetch"}},
                "required": ["url"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "github_save",
            "description": "Save a file to the GitHub repository. Use to persist all research notes and outputs.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path in repo. Example: the-wolf-of-italy/team-notes/RESEARCH-CRYPTO-1/2026-04-21/raw_notes.md"},
                    "content": {"type": "string", "description": "File content in markdown format"},
                    "message": {"type": "string", "description": "Git commit message"},
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
    """Run one agent in an agentic loop until it saves its output and returns."""
    if stagger:
        await asyncio.sleep(stagger)

    system = CEO_SYSTEM + f"\n\nYou are acting as {name}. Date: {DATE}."
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": task},
    ]

    print(f"  [{name}] starting... (model: {MODEL})")

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

            # Append assistant message with tool calls
            messages.append({
                "role": "assistant",
                "content": choice.message.content,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in tool_calls
                ],
            })

            # Execute each tool and append result
            for tc in tool_calls:
                fn_name = tc.function.name
                try:
                    fn_args = json.loads(tc.function.arguments or "{}")
                except json.JSONDecodeError:
                    fn_args = {}
                fn = TOOL_REGISTRY.get(fn_name)
                print(f"  [{name}] tool: {fn_name}({list(fn_args.keys())})")
                try:
                    result = await fn(**fn_args) if fn else f"Tool {fn_name} not found"
                except Exception as e:
                    result = f"Error calling {fn_name}: {e}"
                # If github_save succeeded, agent is done
                if fn_name == "github_save" and isinstance(result, dict) and result.get("ok"):
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": json.dumps(result),
                    })
                    print(f"  [{name}] done after {iteration+1} steps")
                    return {"name": name, "status": "ok", "output": f"Saved to {result['path']}"}
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(result) if not isinstance(result, str) else result,
                })

    return {"name": name, "status": "timeout", "output": "Max iterations reached"}

# ── AGENT DEFINITIONS ──────────────────────────────────────────────────────

def load_workflow(filename: str) -> str:
    path = Path(__file__).parent / "workflows" / filename
    return path.read_text() if path.exists() else ""

ACTIVE_AGENTS = [
    {
        "name": "RESEARCH-CRYPTO-1",
        "task": f"""You are RESEARCH-CRYPTO-1. Date: {DATE}.

{load_workflow("research_crypto.md")}

Execute your full daily workflow now. Use coingecko_trending and coingecko_markets.
Find at least 1 concrete opportunity. Save to GitHub at:
  the-wolf-of-italy/team-notes/RESEARCH-CRYPTO-1/{DATE}/raw_notes.md
Commit: "RESEARCH-CRYPTO-1: raw notes {DATE}"
After saving, summarize the top signal found.""",
    },
    {
        "name": "RESEARCH-AI-1",
        "task": f"""You are RESEARCH-AI-1. Date: {DATE}.

{load_workflow("research_ai.md")}

Execute your daily workflow. IMPORTANT: make at most 4 fetch_url calls total.
1. Fetch HackerNews top stories: https://hacker-news.firebaseio.com/v0/topstories.json
2. Get details for the first 3 story IDs ONLY (3 calls max)
3. Identify 3 AI monetization methods based on what you found
Save to GitHub at:
  the-wolf-of-italy/team-notes/RESEARCH-AI-1/{DATE}/raw_notes.md
Commit: "RESEARCH-AI-1: raw notes {DATE}"
After saving, summarize the best method found.""",
    },
    {
        "name": "RESEARCH-MARKET-1",
        "task": f"""You are RESEARCH-MARKET-1. Date: {DATE}.

{load_workflow("research_market.md")}

Execute your full daily workflow:
1. Fetch https://hacker-news.firebaseio.com/v0/topstories.json
2. Get details for first 3 story IDs
3. Fetch https://api.llama.fi/protocols (DeFiLlama)
4. Identify 3 market signals
Save to GitHub at:
  the-wolf-of-italy/team-notes/RESEARCH-MARKET-1/{DATE}/raw_notes.md
Commit: "RESEARCH-MARKET-1: raw notes {DATE}"
After saving, confirm.""",
    },
    {
        "name": "EXECUTION-1",
        "task": f"""You are EXECUTION-1. Date: {DATE}.

{load_workflow("execution.md")}

Step 1: Try to fetch pending opportunities from GitHub:
  fetch_url: https://api.github.com/repos/nicolostancato-web/pump-scanner/contents/the-wolf-of-italy/knowledge_base/opportunities

NOTE: This folder may not exist yet (404 is expected on day 1). That is fine.

Step 2: Based on what you know about crypto and AI monetization, identify ONE concrete zero-cost test
that EXECUTION-1 could run TODAY or TOMORROW. It must be:
- Legal
- Zero cost
- Executable without new credentials
- Completable in under 2 hours

Example types: test a free DeFi protocol UI, verify an airdrop eligibility, benchmark a free AI API,
check a referral program payout, verify a grant application process.

Step 3: Save your execution log to GitHub. You MUST call github_save.
Path: the-wolf-of-italy/team-notes/EXECUTION-1/{DATE}/execution_log.md
Commit: "EXECUTION-1: daily log {DATE}"

The log must include: pending opportunities reviewed, proposed next test, and steps to execute it.""",
    },
    {
        "name": "FINANCE-1",
        "task": f"""You are FINANCE-1 / CFO. Date: {DATE}.

{load_workflow("finance.md")}

Today's orchestrator run: 7 agents × free Gemini model = $0.00.
Infrastructure: n8n (~$35), Railway (~$15). Total: ~$50/month estimated.

Produce CFO note with full cost breakdown and any savings identified.
Save to GitHub at:
  the-wolf-of-italy/team-notes/FINANCE-1/{DATE}/cfo_note.md
Commit: "FINANCE-1: CFO note {DATE}"
After saving, confirm.""",
    },
    {
        "name": "QUALITY-CONTROL-1",
        "task": f"""You are QUALITY-CONTROL-1. Date: {DATE}.

{load_workflow("quality_control.md")}

Check which teams produced notes today. For each team below, check if a file exists at:
  https://api.github.com/repos/nicolostancato-web/pump-scanner/contents/the-wolf-of-italy/team-notes/[TEAM]/{DATE}

Teams to check: RESEARCH-CRYPTO-1, RESEARCH-AI-1, RESEARCH-MARKET-1, EXECUTION-1, FINANCE-1, SECURITY-1

Note: you are running in parallel with other agents, so some files may not exist yet when you check.
Document what you find and give an honest audit score.

Save QC report to GitHub at:
  the-wolf-of-italy/team-notes/QUALITY-CONTROL-1/{DATE}/qc_report.md
Commit: "QUALITY-CONTROL-1: audit {DATE}"
After saving, confirm.""",
    },
    {
        "name": "SECURITY-1",
        "task": f"""You are SECURITY-1. Date: {DATE}.

{load_workflow("security.md")}

Run today's lightweight security check:
1. Calculate days until n8n JWT expiry (2026-06-03 from today {DATE})
2. Check Solana wallet on Solscan: fetch_url https://public-api.solscan.io/account/E51F1pku95NG7oXbAHGmquP4sy31hucfok7EiwbanuxV
3. Log any new credentials or risks

Save security note to GitHub at:
  the-wolf-of-italy/team-notes/SECURITY-1/{DATE}/security_note.md
Commit: "SECURITY-1: daily note {DATE}"
After saving, confirm.""",
    },
]

# ── MAIN ───────────────────────────────────────────────────────────────────

async def main():
    print(f"\n{'='*60}")
    print(f"The Wolf of Italy — Orchestrator")
    print(f"Date: {DATE} | Agents: {len(ACTIVE_AGENTS)} | Model: {MODEL}")
    print(f"{'='*60}\n")

    # Stagger all agents by 8s to respect Gemini's 15 RPM free limit
    tasks = [
        run_agent(a["name"], a["task"], stagger=i * 8)
        for i, a in enumerate(ACTIVE_AGENTS)
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    print(f"\n{'─'*40}")
    print("SUMMARY:")
    for r in results:
        if isinstance(r, Exception):
            print(f"  ERROR: {r}")
        else:
            status = "✅" if r["status"] == "ok" else "⚠️"
            print(f"  {status} {r['name']}: {r['status']}")

    print(f"\nOrchestrator complete — {DATE}")

if __name__ == "__main__":
    asyncio.run(main())
