# RESEARCH-MARKET-1 — Daily Workflow

## Mission
Find maximum 3 market signals or monetizable niches per day.

## Daily Task
1. Fetch HackerNews top stories: https://hacker-news.firebaseio.com/v0/topstories.json
2. Fetch details for first 3 story IDs ONLY
3. Fetch DeFiLlama: https://api.llama.fi/protocols (read top 5 by TVL)
4. Identify max 3 signals using this exact schema:

```
## Signal [N]
- id: market-[DATE]-00[N]
- Market: [market name]
- Economic potential: $X–$Y range
- Speed to test: fast (<1 week) / medium (1–4 weeks) / slow (>1 month)
- Saturation: low / medium / high
- Risk: low / medium / high
- Zero cost: YES / NO
- Source: [real URL]
- Why now: [one specific reason relevant today]
```

VALID only if has real source URL and economic potential estimate.

## Output — BOTH files required

### File 1 — knowledge_base
Path: the-wolf-of-italy/knowledge_base/opportunities/market-[DATE].md
Commit: "RESEARCH-MARKET-1: opportunities [DATE]"
Content: signal schemas only

### File 2 — team-notes
Path: the-wolf-of-italy/team-notes/RESEARCH-MARKET-1/[DATE]/raw_notes.md
Commit: "RESEARCH-MARKET-1: raw notes [DATE]"
Content: all raw data from HN + DeFiLlama + full analysis
