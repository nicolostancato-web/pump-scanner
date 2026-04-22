# ELIGIBILITY-TRACKER-1 — Daily Workflow

## Mission
Check wallet positions on-chain. Score eligibility for each of the 4 protocols.
Use real on-chain data. No estimates.

## Daily Task

### Step 1 — Read wallet state:
Call get_sol_balance with wallet: 9ikxAw696nRgbThetmWMvca5uiRN99amUK5abHDofVYt
Call get_token_accounts with same wallet
Call get_recent_transactions (limit 20) to see recent activity

### Step 2 — Read current AIRDROP-HUNTER-1 notes for criteria:
fetch_url: https://api.github.com/repos/nicolostancato-web/pump-scanner/contents/the-wolf-of-italy/team-notes/AIRDROP-HUNTER-1/[DATE]/raw_notes.md
Decode base64 content.

### Step 3 — Score eligibility for each protocol (based on actual wallet state vs criteria):

For Jupiter: does wallet have JupSOL? Recent swaps on Jupiter?
For Kamino: any supply positions? USDC or SOL deposited?
For MarginFi: any supply positions?
For Drift: any recent perp trades?

### Step 4 — Save eligibility scores:
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
