# ELIGIBILITY-TRACKER-1 — Daily Workflow

## Mission
Check wallet positions on-chain. Score eligibility for each of the 4 protocols.
Use real on-chain data. No estimates.

## Daily Task

### Step 1 — Read wallet state + SOL price:
Call get_sol_balance with wallet: 9ikxAw696nRgbThetmWMvca5uiRN99amUK5abHDofVYt
Call get_token_accounts with same wallet
Call get_recent_transactions (limit 20) to see recent activity
fetch_url: https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd
Use the fetched SOL price for all USD calculations. Never estimate or hardcode the price.

### Step 2 — Read AIRDROP-HUNTER-1 intel (knowledge_base, not team-notes):
fetch_url: https://api.github.com/repos/nicolostancato-web/pump-scanner/contents/the-wolf-of-italy/knowledge_base/airdrop_intel/[DATE].md
Decode base64 content.
If 404 (AIRDROP-HUNTER hasn't saved yet — possible in parallel execution): note "airdrop_intel not available" and proceed with on-chain data only. Do NOT fabricate or interpolate AIRDROP-HUNTER conclusions.

### Step 3 — Check proposals_executed for confirmed actions:
fetch_url: https://api.github.com/repos/nicolostancato-web/pump-scanner/contents/the-wolf-of-italy/knowledge_base/proposals_executed
List the folder. For each file dated within the last 30 days, read it to know what has been executed.
This is the ground truth for what the founder has done — use it to inform eligibility scores.

### Step 4 — Score eligibility for each protocol:

**Jupiter scoring rules (in order of priority):**
- If wallet has JupSOL (mint: jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v) with balance > 0:
  → eligibility = LOW (holding position confirmed)
  → What we have: "X.XXX JupSOL — holding position established"
  → What's missing: "Swap volume on Jupiter DEX to reach MEDIUM"
- If JupSOL balance > 0 AND proposals_executed shows Jupiter swap executed:
  → eligibility = LOW-MEDIUM
- If no JupSOL and no Jupiter activity: eligibility = NONE

**Kamino scoring rules:**
- If wallet has kTokens (Kamino supply tokens) or USDC/SOL deposited on Kamino: LOW or higher
- Otherwise: NONE

**MarginFi scoring rules:**
- If wallet has mSOL or supply positions on MarginFi: LOW or higher
- Otherwise: NONE

**Drift scoring rules:**
- If recent transactions show Drift program interactions: LOW or higher
- Otherwise: NONE

### Step 5 — Save eligibility scores:
Path: the-wolf-of-italy/knowledge_base/eligibility_scores/[DATE].md
Commit: "ELIGIBILITY-TRACKER-1: scores [DATE]"

Format:
```
# Eligibility Scores — [DATE]

## Wallet: 9ikxAw696nRgbThetmWMvca5uiRN99amUK5abHDofVYt
SOL balance: X.XX SOL ($XX.XX at $XXX/SOL)
Token positions: [list or None]
Recent activity: [N transactions in last 7 days]

## Protocol Scores

### Jupiter
- Current eligibility: [NONE / LOW / MEDIUM / HIGH]
- What we have: [specific on-chain fact]
- What's missing: [specific action needed]
- Estimated gain if acted: [e.g. "+500 JUP points" or "unknown"]
- Priority: P1 / P2 / P3

### Kamino
[same format]

### MarginFi
[same format]

### Drift
[same format]

## Summary
Lowest coverage: [protocol name] — action most needed
Highest coverage: [protocol name] — best positioned
Recommended focus: [protocol + reason]
```
