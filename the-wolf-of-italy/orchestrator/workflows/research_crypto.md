# RESEARCH-CRYPTO-1 — Daily Workflow

## Mission
Find maximum 3 concrete crypto opportunities per day. Real data only.

## Daily Task
1. Call coingecko_trending
2. Call coingecko_markets (limit 20)
3. Identify max 3 opportunities using this exact schema:

```
## Opportunity [N]
- Name: [coin/protocol name + ticker]
- Why profit: [specific reason with real numbers]
- Real data: price $X | 24h change: +X% | volume $X | market cap $X
- Risk: LOW / MEDIUM / HIGH — reason: [one line]
- Test speed: [X hours to verify]
- Priority: P1 / P2 / P3
- Test method: [exactly what EXECUTION could do for free in <2h]
```

VALID only if all fields filled with real numbers. No vague statements.

## Output — BOTH files required

### File 1 — knowledge_base (for CEO + Execution flow)
Path: the-wolf-of-italy/knowledge_base/opportunities/crypto-[DATE].md
Commit: "RESEARCH-CRYPTO-1: opportunities [DATE]"
Content: opportunity schemas only, clean format

### File 2 — team-notes (full research archive)
Path: the-wolf-of-italy/team-notes/RESEARCH-CRYPTO-1/[DATE]/raw_notes.md
Commit: "RESEARCH-CRYPTO-1: raw notes [DATE]"
Content: all raw API data + full analysis
