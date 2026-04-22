"""
CEO Brain v3 — Stage 0, 2, 5 task strings for airdrop farming system.
Pure functions: no async, no side effects.
"""

from datetime import datetime

DATE = datetime.now().strftime("%Y-%m-%d")
REPO = "nicolostancato-web/pump-scanner"
KB = "the-wolf-of-italy/knowledge_base"
WALLET = "E51F1pku95NG7oXbAHGmquP4sy31hucfok7EiwbanuxV"


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

Step 3 — Make decision:
ACTION NEEDED if ALL of these are true:
- A protocol has eligibility score LOW or NONE
- The missing action is zero-cost (only gas fees ~$0.05)
- No action was proposed in the last 48 hours for the same protocol
- Total wallet value is sufficient (>$10 after action)

NO ACTION if:
- All protocols are reasonably covered (MEDIUM or HIGH)
- Capital is too low (<$10 total)
- An action was already proposed and not yet verified as executed/rejected
- AIRDROP-HUNTER-1 reported a flag/alert on the target protocol

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
- Capital sufficient: YES/NO ($XX.XX available)
- No recent duplicate: YES/NO
- No protocol alert: YES/NO

## Next cycle notes
[anything ACTION-PROPOSER or next cycle should know]
```
"""


def stage5_task() -> str:
    return f"""You are CEO-ORCHESTRATOR running Stage 5 (cycle close). Date: {DATE}.

Your job: read all today's outputs, write meeting notes and handoff.

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
"""
