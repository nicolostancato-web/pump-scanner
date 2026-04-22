# CFO-SECURITY-1 — Daily Workflow

## Mission
Two jobs in one agent: financial state + security audit.
Report real numbers. Raise real flags. No padding.

## Daily Task

### Step 1 — Read wallet state:
Call get_sol_balance with wallet: 9ikxAw696nRgbThetmWMvca5uiRN99amUK5abHDofVYt
Call get_token_accounts with same wallet

### Step 2 — Get SOL price:
fetch_url: https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd

### Step 3 — Check if yesterday's proposal was executed:
fetch_url: https://api.github.com/repos/nicolostancato-web/pump-scanner/contents/the-wolf-of-italy/knowledge_base/proposals_sent
List folder, find yesterday's proposal file, read it.
Then call get_recent_transactions to see if matching on-chain tx exists.
(Match by: amount + approximate time + protocol)

### Step 4 — Check protocol health (TVL check):
fetch_url: https://api.llama.fi/tvl/kamino
fetch_url: https://api.llama.fi/tvl/marginfi

### Step 5 — Save wallet snapshot:
Path: the-wolf-of-italy/knowledge_base/wallet_snapshots/[DATE].md
Commit: "CFO-SECURITY-1: wallet snapshot [DATE]"

Format:
```
# Wallet Snapshot — [DATE]
CFO-SECURITY-1

## Balances
- SOL: X.XX SOL = $XX.XX (SOL price: $XXX)
- [Token 1]: X.XX = $XX.XX
- [Token 2]: ...
- TOTAL VALUE: $XX.XX

## Yesterday's Proposal
- Proposal file: [DATE]-1.md / NONE
- Action proposed: [summary or None]
- Executed on-chain: YES / NO / UNVERIFIED
  Basis: [tx signature if found, or "no matching tx in last 24h"]

## Protocol Health
| Protocol | TVL | Status |
|---|---|---|
| Jupiter | $XXXm | OK / ALERT |
| Kamino | $XXXm | OK / ALERT |
| MarginFi | $XXXm | OK / ALERT |
| Drift | $XXXm | OK / ALERT |

## Infrastructure Costs
- Railway: ~€14/month (~€0.47/day)
- DeepSeek: ~€0.01/cycle
- TOTAL monthly: ~€15

NOTE: n8n è infrastruttura condivisa del founder (forniture, ristorante, trading, magazzino). NON includere n8n nei costi Wolf of Italy. Solo Railway + LLM sono costi reali di Wolf of Italy.

## Security Flags
[REAL flags only — e.g. "Drift TVL dropped 40% in 24h" or "n8n JWT expires in X days"]
[If no real flags: "No flags today"]

## CFO Recommendation
[One concrete action — e.g. "Execute Jupiter proposal" or "No action needed"]
```
