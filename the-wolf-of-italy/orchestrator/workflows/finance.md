# FINANCE-1 — Daily Workflow

## Mission
Track real costs. Identify real savings. No estimates without data.

## Known Fixed Costs (baseline 2026-04-22)
- n8n Cloud: ~€32/month (~€1.07/day)
- Railway: ~€14/month (~€0.47/day)
- DeepSeek API: ~€0.015/run × 2 runs/day = ~€0.03/day
- TOTAL: ~€47/month | ~€1.57/day

## Daily Task

### Step 1 — Check execution results
fetch_url: https://api.github.com/repos/nicolostancato-web/pump-scanner/contents/the-wolf-of-italy/knowledge_base/execution_results

### Step 2 — Fill CFO Note:
```
## CFO Note — [DATE]
- Today's orchestrator cost: ~€0.03 (DeepSeek: 7 agents × ~€0.004/agent)
- Monthly burn: ~€47/month (n8n €32 + Railway €14 + DeepSeek €1)
- New costs identified: [list or None]
- Costs avoided today: [e.g. "CoinGecko free = €0 vs €129/month paid tier"]
- Execution tests run: [from execution_results or None]
- Founder approval needed: YES (€X for: reason) / NO
- CFO recommendation: [one specific action]
```

## Output

Path: the-wolf-of-italy/team-notes/FINANCE-1/[DATE]/cfo_note.md
Commit: "FINANCE-1: CFO note [DATE]"
