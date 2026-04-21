#!/usr/bin/env python3
"""
The Wolf of Italy — Multi-Agent Orchestrator
WAT Framework: Workflows + Agent + Tools

Runs all active team agents in parallel.
Each agent fetches real data and saves notes to GitHub.
"""

import asyncio
import json
import os
import base64
from datetime import datetime
from pathlib import Path

import httpx
from anthropic import AsyncAnthropic
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
GITHUB_TOKEN = os.environ["GITHUB_TOKEN"]
GITHUB_REPO = os.environ.get("GITHUB_REPO", "nicolostancato-web/pump-scanner")
DATE = datetime.now().strftime("%Y-%m-%d")
MODEL_SONNET = "claude-sonnet-4-6"
MODEL_HAIKU = "claude-haiku-4-5-20251001"  # cheaper + higher rate limits for simple tasks

client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

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
    async with httpx.AsyncClient(timeout=20) as http:
        r = await http.put(
            f"https://api.github.com/repos/{GITHUB_REPO}/contents/{path}",
            json={"message": message, "content": encoded},
            headers={
                "Authorization": f"token {GITHUB_TOKEN}",
                "Accept": "application/vnd.github.v3+json",
            },
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
        "name": "coingecko_trending",
        "description": "Fetch top trending cryptocurrencies from CoinGecko. Free, no API key needed.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "coingecko_markets",
        "description": "Fetch top cryptocurrencies by volume with 24h price change. Returns price, volume, % change.",
        "input_schema": {
            "type": "object",
            "properties": {"limit": {"type": "integer", "description": "Number of coins to fetch (max 50)", "default": 20}},
            "required": [],
        },
    },
    {
        "name": "fetch_url",
        "description": "Fetch content from any public URL. Use for APIs, web pages, RSS feeds, JSON endpoints.",
        "input_schema": {
            "type": "object",
            "properties": {"url": {"type": "string", "description": "The URL to fetch"}},
            "required": ["url"],
        },
    },
    {
        "name": "github_save",
        "description": "Save a file to the GitHub repository. Use to persist all research notes and outputs.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path in repo. Example: the-wolf-of-italy/team-notes/RESEARCH-CRYPTO-1/2026-04-21/raw_notes.md"},
                "content": {"type": "string", "description": "File content in markdown format"},
                "message": {"type": "string", "description": "Git commit message"},
            },
            "required": ["path", "content", "message"],
        },
    },
]

# ── CEO SYSTEM PROMPT ──────────────────────────────────────────────────────

def load_ceo_system() -> str:
    claude_md = Path(__file__).parent / "CLAUDE.md"
    return claude_md.read_text() if claude_md.exists() else ""

CEO_SYSTEM = load_ceo_system()

# ── AGENT RUNNER ───────────────────────────────────────────────────────────

HAIKU_AGENTS = {"FINANCE-1", "SECURITY-1", "QUALITY-CONTROL-1", "EXECUTION-1"}

async def run_agent(name: str, task: str, stagger: int = 0) -> dict:
    """Run one agent in an agentic loop until it saves its output and returns."""
    if stagger:
        await asyncio.sleep(stagger)

    model = MODEL_HAIKU if name in HAIKU_AGENTS else MODEL_SONNET
    messages = [{"role": "user", "content": task}]
    system = CEO_SYSTEM + f"\n\nYou are acting as {name}. Date: {DATE}."

    print(f"  [{name}] starting... (model: {model})")

    for iteration in range(10):
        response = await client.messages.create(
            model=model,
            max_tokens=4096,
            system=system,
            tools=TOOLS_SCHEMA,
            messages=messages,
        )

        if response.stop_reason == "end_turn":
            text = " ".join(b.text for b in response.content if hasattr(b, "text"))
            print(f"  [{name}] done after {iteration+1} steps")
            return {"name": name, "status": "ok", "output": text}

        if response.stop_reason == "tool_use":
            messages.append({"role": "assistant", "content": response.content})
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    fn = TOOL_REGISTRY.get(block.name)
                    try:
                        result = await fn(**block.input) if fn else f"Tool {block.name} not found"
                    except Exception as e:
                        result = f"Error calling {block.name}: {e}"
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(result) if not isinstance(result, str) else result,
                    })
            messages.append({"role": "user", "content": tool_results})

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

Execute your full daily workflow now.
1. Fetch HackerNews top stories: https://hacker-news.firebaseio.com/v0/topstories.json
2. Get details for the first 5 story IDs
3. Identify 3 AI monetization methods active today
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

Check GitHub for pending opportunities:
  fetch_url: https://api.github.com/repos/nicolostancato-web/pump-scanner/contents/the-wolf-of-italy/knowledge_base/opportunities

If the folder doesn't exist yet or is empty, document that and propose the first zero-cost test
to run tomorrow based on what RESEARCH-CRYPTO-1 or RESEARCH-AI-1 may have found.

Save execution log to GitHub at:
  the-wolf-of-italy/team-notes/EXECUTION-1/{DATE}/execution_log.md
Commit: "EXECUTION-1: daily log {DATE}"
After saving, confirm.""",
    },
    {
        "name": "FINANCE-1",
        "task": f"""You are FINANCE-1 / CFO. Date: {DATE}.

{load_workflow("finance.md")}

Today's orchestrator run: 7 agents × ~$0.08/agent = ~$0.56 estimated.
Monthly: 2 runs/day × 30 × $0.56 = ~$33/month for agents alone.
Plus n8n (~$35), Railway (~$15). Total: ~$83/month estimated.

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
2. Check Solana wallet on Solscan: fetch_url https://api.mainnet-beta.solana.com with POST body to check E51F1pku95NG7oXbAHGmquP4sy31hucfok7EiwbanuxV
   (or use: https://public-api.solscan.io/account/E51F1pku95NG7oXbAHGmquP4sy31hucfok7EiwbanuxV)
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
    print(f"Date: {DATE} | Agents: {len(ACTIVE_AGENTS)}")
    print(f"{'='*60}\n")

    # Stagger starts: research agents use Sonnet (heavy), others use Haiku (lighter)
    # Sonnet agents staggered by 15s to stay under 30K TPM rate limit
    sonnet_delay = 0
    tasks = []
    for a in ACTIVE_AGENTS:
        delay = 0
        if a["name"] not in HAIKU_AGENTS:
            delay = sonnet_delay
            sonnet_delay += 15
        tasks.append(run_agent(a["name"], a["task"], stagger=delay))
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
