"""
CEO Brain v3 — Stage 0, 2, 5 task strings for airdrop farming system.
Pure functions: no async, no side effects.
"""

from datetime import datetime

DATE = datetime.now().strftime("%Y-%m-%d")
REPO = "nicolostancato-web/pump-scanner"
KB = "the-wolf-of-italy/knowledge_base"
WALLET = "9ikxAw696nRgbThetmWMvca5uiRN99amUK5abHDofVYt"


def stage0_task() -> str:
    return f"""You are CEO-ORCHESTRATOR running Stage 0 (cycle open). Date: {DATE}.

Your job: find the latest handoff file, read it, produce today's cycle plan.

Step 1 — List handoffs:
fetch_url: https://api.github.com/repos/{REPO}/contents/{KB}/handoffs

This returns a JSON array. Find files named *-handoff.md (not bootstrap, not cycle-plan).
Take the file with the most recent name. If none exist: this is the first cycle.

Step 2 — Read latest handoff (if exists):
fetch_url: https://api.github.com/repos/{REPO}/contents/{KB}/handoffs/[filename]
Decode base64 "content" field.

Step 3 — Save cycle plan:
Path: {KB}/handoffs/{DATE}-cycle-plan.md
Commit: "CEO: cycle plan {DATE}"

Cycle plan format:
```
# Cycle Plan — {DATE}
Based on: [handoff filename / "bootstrap — first cycle"]

## Open items
[from handoff "Open items" section, or "None"]

## Priority for this cycle
1. [most important]
2. [second]
3. [third]

## Protocol focus
[which of the 4 protocols needs most attention today, based on handoff]
```

If no handoff found: save cycle plan with "First cycle — no prior context. Research all 4 protocols."
"""


def stage2_task() -> str:
    return f"""You are CEO-ORCHESTRATOR running Stage 2 (decision). Date: {DATE}.

Your job: read eligibility scores, decide if action is needed today, write decision log.

Step 1 — Read eligibility scores:
fetch_url: https://api.github.com/repos/{REPO}/contents/{KB}/eligibility_scores/{DATE}.md
Decode base64 content.

Step 2 — Read cycle plan for context:
fetch_url: https://api.github.com/repos/{REPO}/contents/{KB}/handoffs/{DATE}-cycle-plan.md
Decode base64 content.

Step 3 — Understand capital structure before deciding:
The wallet has two distinct capital buckets:
- CASH LIBERO = liquid SOL only (usable for new operations)
- POSIZIONI ATTIVE = tokens in proposals_executed/ (capital at work, approved by board — NOT a loss, NOT a crisis)

NEVER treat approved positions (JupSOL, USDC, etc.) as "lost capital" or "capital crisis".
The correct capital check uses CASH LIBERO (liquid SOL), not portfolio total.

ACTION NEEDED if ALL of these are true:
- A protocol has eligibility score LOW or NONE
- The missing action is zero-cost (only gas fees ~$0.05)
- No action was proposed in the last 48 hours for the same protocol
- CASH LIBERO (liquid SOL in USD) > cost of proposed action + $5 buffer

NO ACTION if:
- All protocols are reasonably covered (MEDIUM or HIGH)
- CASH LIBERO < cost of proposed action + $5 buffer
- An action was already proposed and not yet verified as executed/rejected
- AIRDROP-HUNTER-1 reported a flag/alert on the target protocol

NEVER write "capital crisis" or "target $100+" — no such target exists.
If CASH LIBERO is low but POSIZIONI ATTIVE are healthy, write "low liquidity for new actions" not "capital crisis".

Step 4 — Save decision log:
Path: {KB}/decision_log/{DATE}.md
Commit: "CEO: decision log {DATE}"

Decision log format:
```
# Decision Log — {DATE}
CEO-ORCHESTRATOR

## Decision
ACTION: YES / NO

## Rationale
[2-3 sentences: what drove the decision, which protocol, current eligibility gap]

## Target protocol (if ACTION: YES)
[protocol name + specific eligibility gap to close]

## Constraint check
- Zero cost: YES/NO
- Cash libero sufficient: YES/NO ($XX.XX liquid SOL available, $XX.XX in active positions)
- No recent duplicate: YES/NO
- No protocol alert: YES/NO

## Next cycle notes
[anything ACTION-PROPOSER or next cycle should know]
```
"""


def stage5_task() -> str:
    return f"""You are CEO-ORCHESTRATOR running Stage 5 (cycle close). Date: {DATE}.

Your job: read all today's outputs, write meeting notes, write handoff, then send emails.

Step 1 — Read today's key files (decode base64; note MISSING if 404):
- fetch_url: .../contents/{KB}/eligibility_scores/{DATE}.md
- fetch_url: .../contents/{KB}/decision_log/{DATE}.md
- fetch_url: .../contents/{KB}/proposals_sent/{DATE}.md
- fetch_url: .../contents/{KB}/wallet_snapshots/{DATE}.md

Use: https://api.github.com/repos/{REPO}/contents/

Step 2 — Save meeting notes:
Path: {KB}/meeting_notes/{DATE}.md
Commit: "CEO: meeting notes {DATE}"

Format:
```
# Meeting Notes — {DATE}
CEO-ORCHESTRATOR

## Agent Status
| Agent | Output | Status |
|---|---|---|
| AIRDROP-HUNTER-1 | team-notes/.../raw_notes.md | ok/MISSING |
| ELIGIBILITY-TRACKER-1 | eligibility_scores/{DATE}.md | ok/MISSING |
| CEO decision | decision_log/{DATE}.md | ok/MISSING |
| ACTION-PROPOSER-1 | proposals_sent/{DATE}.md | ok/MISSING / NO ACTION |
| CFO-SECURITY-1 | wallet_snapshots/{DATE}.md | ok/MISSING |

## Wallet Today
[total value, SOL balance, token positions — from wallet_snapshots]

## Decision taken
[ACTION YES/NO + rationale — from decision_log]

## Proposal sent
[summary of proposal or "No action today"]

## Protocol coverage
| Protocol | Score | Trend |
|---|---|---|
| Jupiter | LOW/MED/HIGH | ↑/↓/= |
| Kamino | LOW/MED/HIGH | ↑/↓/= |
| MarginFi | LOW/MED/HIGH | ↑/↓/= |
| Drift | LOW/MED/HIGH | ↑/↓/= |

## Issues to fix
[honest — missing files, weak output, errors — or "None"]
```

Step 3 — Save handoff:
Path: {KB}/handoffs/{DATE}-handoff.md
Commit: "CEO: handoff {DATE}"

Format:
```
# Handoff — {DATE} → Next Cycle

## What worked
[1–3 honest bullets]

## What failed
[1–3 honest bullets — if an agent was MISSING, say it]

## Open items
- [proposal_sent {DATE}] — verify on-chain if executed tomorrow
- [protocol] — follow up on [specific thing]

## Carry-forward
[anything next cycle must know: pending proposals, protocol alerts, wallet state]

## Priority next cycle
1.
2.
3.
```

Step 4 — Send CEO Daily Report email:
Call send_proposal_email with:
- subject: "CEO Daily Report — {DATE}"
- body: a concise Italian-language summary of today's cycle (5-8 lines max):
  * Wallet: balance + USD value
  * Decision: ACTION YES/NO + one-line rationale
  * Proposal: what was proposed (or "Nessuna azione oggi")
  * Issues: any MISSING agents or errors
  * Next: priority for tomorrow

Example body:
```
CEO Daily Report — {DATE}

💰 Wallet: 0.61 SOL ($54)
✅ Decisione: ACTION YES — Jupiter baseline
📋 Proposta: 0.20 SOL → posizione Jupiter (email investitore inviata separatamente)
⚠️  Issues: AIRDROP-HUNTER-1 team-notes mancanti
➡️  Domani: verifica on-chain esecuzione Jupiter
```

Do NOT include technical DeFi jargon in the CEO Daily Report — write in plain Italian.
Do NOT re-send an Investment Alert here — that is CFO-SECURITY-1's job.
"""
