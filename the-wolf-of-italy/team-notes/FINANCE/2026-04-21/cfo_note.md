# FINANCE-1 — Daily CFO Note
Date: 2026-04-21

## Cost Tracking Today

### Orchestrator Run
- Agent count: 7 agents
- Estimated cost per agent: ~$0.08
- **Today's orchestrator run total: ~$0.56**

### CEO Email Reports
- Daily CEO reports: 2 × ~$0.10 = **~$0.20**

### **Estimated Today Total: ~$0.76**

---

## Daily Breakdown (Anthropic API)
| Service | Tokens | Cost Estimate |
|---------|--------|----------------|
| Orchestrator (7 agents @ 2k tokens/agent) | ~14,000 | ~$0.56 |
| CEO reports (2 × 3k tokens) | ~6,000 | ~$0.20 |
| **Daily Subtotal** | **~20,000** | **~$0.76** |

---

## Monthly Burn Estimate

### Orchestrator + API Usage
- Daily agent runs: 2 orchestrator cycles/day × 7 agents = 14 agent executions
- Cost per cycle: ~$0.56
- Monthly orchestrator: 2 runs/day × 30 days × $0.56 = **~$33.60**
- Monthly CEO reports: 2 reports/day × 30 days × $0.10 = **~$6.00**
- **Anthropic API monthly: ~$39.60**

### Infrastructure
| Service | Monthly Cost |
|---------|--------------|
| n8n Cloud | ~$35 |
| Railway (pump-scanner, dex-scanner, orchestrator) | ~$15 |
| CoinGecko API | $0 (free tier) |
| GitHub | $0 |
| **Infrastructure subtotal** | **~$50** |

### **Projected Monthly Burn: ~$89.60**

---

## Costs Avoided Today
- **CoinGecko API**: Using free tier (no cost) for trending/markets data
  - Free tier limit: sufficient for daily monitoring
  - Saved: $20-50/month vs. paid plan
- **GitHub**: No costs (free org repo for all notes and output)
  - Saved: $0 (would be $7-21/month if private repo required)

**Total daily savings from free alternatives: estimated $0.67-1.67/day**

---

## Alerts
✅ **CoinGecko free tier**: No risk of limit breach. 50 requests/minute adequate for 2 daily scans.
✅ **Anthropic token budget**: On track. Estimated $39.60/month is sustainable.
✅ **Railway**: No unexpected spike. Standard baseline tier active.
⚠️ **n8n Cloud**: Verify workflow complexity doesn't trigger overage. Monitor next week.

---

## Budget Health
- **Baseline monthly**: ~$89.60
- **Runway (500 SOL @ $200 SOL current)**: ~$100,000 / $89.60 = **~1,116 months (93 years)**
- **Status**: ✅ GREEN — Fully sustainable. No founder approval needed.

---

## Founder Approval Needed
**None today.** All costs within expected baseline. No new services added.

---

## Notes
- Orchestrator efficiency: 7 agents × 2 cycles/day = 14 executions = ~$0.56/cycle is cost-effective for crypto intelligence gathering
- Free tier strategy working: CoinGecko + GitHub + Anthropic free trial components allow max leverage
- Monthly projection remains conservative — actual usage tracking will refine estimate by end of week
