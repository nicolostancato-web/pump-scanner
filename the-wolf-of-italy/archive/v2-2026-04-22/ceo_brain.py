"""
CEO Brain — task strings for Stage 0, 2, and 5
Pure functions: no async, no side effects. Called by orchestrator.py.
"""

from datetime import datetime

DATE = datetime.now().strftime("%Y-%m-%d")
REPO = "nicolostancato-web/pump-scanner"
KB = "the-wolf-of-italy/knowledge_base"


def stage0_task() -> str:
    return f"""You are CEO-ORCHESTRATOR running Stage 0 (cycle open). Date: {DATE}.

Your job: find the latest handoff, read it, write a short cycle plan for today.

Step 1 — List handoffs folder:
fetch_url: https://api.github.com/repos/{REPO}/contents/{KB}/handoffs

This returns a JSON array. Find the file with the highest name (most recent).
If the folder is empty or returns 404: this is the first ever cycle — skip to Step 3.

Step 2 — Read the latest handoff:
fetch_url: https://api.github.com/repos/{REPO}/contents/{KB}/handoffs/[latest filename]
The file content is base64-encoded in the "content" field. Decode it.

Step 3 — Save cycle plan:
Path: {KB}/handoffs/{DATE}-cycle-plan.md
Commit: "CEO: cycle plan {DATE}"

Cycle plan format:
```
# Cycle Plan — {DATE}
Based on: [handoff filename, or "first cycle — no previous handoff"]

## Open items from last cycle
[copy from handoff "Open items" section, or "None — first cycle"]

## Priority for this cycle
1. [most important item]
2. [second]
3. [third if any]

## Research focus
[what Research agents should watch based on carry-forward context,
 or "No carry-forward — research freely" for first cycle]
```
"""


def stage2_task() -> str:
    return f"""You are CEO-ORCHESTRATOR running Stage 2 (opportunity selection). Date: {DATE}.

Your job: read today's research, select max 2 opportunities, write execution queue and decision log.

Step 1 — Read cycle plan (for carry-forward context):
fetch_url: https://api.github.com/repos/{REPO}/contents/{KB}/handoffs/{DATE}-cycle-plan.md
Decode base64. Note the "Open items" and "Priority" sections.

Step 2 — Read all 3 research outputs (decode base64 "content" field of each):
fetch_url: https://api.github.com/repos/{REPO}/contents/{KB}/opportunities/crypto-{DATE}.md
fetch_url: https://api.github.com/repos/{REPO}/contents/{KB}/opportunities/ai-{DATE}.md
fetch_url: https://api.github.com/repos/{REPO}/contents/{KB}/opportunities/market-{DATE}.md
If a file returns 404: skip it and work with what is available.

Step 3 — Select max 2 opportunities meeting ALL criteria:
- zero_cost: YES
- testable in <4 hours with existing tools (coingecko, fetch_url, github_save)
- legal
- no new credentials needed

Step 4 — Save execution queue:
Path: {KB}/execution_queue/{DATE}-queue.md
Commit: "CEO: execution queue {DATE}"

Queue format:
```
# Execution Queue — {DATE}
Selected by: CEO-ORCHESTRATOR

## Selected 1
- ref: [opp id, e.g. crypto-{DATE}-001]
- source_file: [which .md file this came from]
- full_opportunity: [paste the full opportunity schema from the research file]
- rationale: [why selected — one sentence with specific reason]
- acceptance_criteria: [what EXECUTION-1 must show to call it success]
- max_time_budget: 2h

## Selected 2 (if any)
[same format]

## Rejected
| ref | reason |
|---|---|
| ai-{DATE}-002 | needs OpenAI API credits |
| market-{DATE}-001 | requires capital to test |

## Note to EXECUTION-1
[any specific instruction or context]
```

If NO opportunity meets the criteria:
```
# Execution Queue — {DATE}
No opportunities meet zero-cost + <4h criteria today.
Reason: [specific]
Recommendation for Research tomorrow: [one concrete improvement]
```

Step 5 — Save decision log:
Path: {KB}/decision_log/{DATE}.md
Commit: "CEO: decision log {DATE}"

Decision log format:
```
# Decision Log — {DATE}

| ref | decision | rationale | evidence_file |
|---|---|---|---|
| crypto-{DATE}-001 | SELECTED | [specific reason] | opportunities/crypto-{DATE}.md |
| ai-{DATE}-002 | REJECTED | [specific reason] | opportunities/ai-{DATE}.md |
```
"""


def stage5_task() -> str:
    return f"""You are CEO-ORCHESTRATOR running Stage 5 (cycle close). Date: {DATE}.

Your job: read all today's outputs, write meeting notes and handoff for the next cycle.

Step 1 — Read today's outputs (decode base64 "content" of each; if 404 note as MISSING):
fetch_url: https://api.github.com/repos/{REPO}/contents/{KB}/execution_results/{DATE}-execution.md
fetch_url: https://api.github.com/repos/{REPO}/contents/{KB}/qc_audits/{DATE}-audit.md
fetch_url: https://api.github.com/repos/{REPO}/contents/{KB}/finance_review
  (list folder, find today's file, read it)
fetch_url: https://api.github.com/repos/{REPO}/contents/{KB}/security_audits/{DATE}-security.md
fetch_url: https://api.github.com/repos/{REPO}/contents/{KB}/decision_log/{DATE}.md

Step 2 — Save meeting notes:
Path: {KB}/meeting_notes/{DATE}.md
Commit: "CEO: meeting notes {DATE}"

Meeting notes format:
```
# Meeting Notes — {DATE}
Cycle closed by: CEO-ORCHESTRATOR

## Agent Output Status
| Agent | File produced | Status | QC Score |
|---|---|---|---|
| RESEARCH-CRYPTO-1 | opportunities/crypto-{DATE}.md | ok/MISSING | PASS/PARTIAL/FAIL |
| RESEARCH-AI-1 | opportunities/ai-{DATE}.md | ok/MISSING | PASS/PARTIAL/FAIL |
| RESEARCH-MARKET-1 | opportunities/market-{DATE}.md | ok/MISSING | PASS/PARTIAL/FAIL |
| CEO-ORCHESTRATOR | execution_queue/{DATE}-queue.md | ok/MISSING | — |
| EXECUTION-1 | execution_results/{DATE}-execution.md | ok/MISSING | PASS/PARTIAL/FAIL |
| FINANCE-1 | finance_review/[file] | ok/MISSING | PASS/PARTIAL/FAIL |
| SECURITY-1 | security_audits/{DATE}-security.md | ok/MISSING | PASS/PARTIAL/FAIL |
| QUALITY-CONTROL-1 | qc_audits/{DATE}-audit.md | ok/MISSING | — |

## Today's test
[from execution_results: what was tested, outcome SUCCESS/PARTIAL/FAIL, revenue €X]

## Financial status
[from finance_review: burn rate, costs today, any flags]

## Security status
[from security_audit: JWT days, any flags]

## QC summary
[from qc_audit: overall score, which agents failed]

## Decisions taken today
[from decision_log: which opps selected/rejected]

## Next cycle priorities
1. [most concrete item]
2.
3.
```

Step 3 — Save handoff:
Path: {KB}/handoffs/{DATE}-handoff.md
Commit: "CEO: handoff {DATE}"

Handoff format:
```
# Handoff — {DATE} → Next Cycle
Written by: CEO-ORCHESTRATOR

## What worked this cycle
[honest 1–3 bullets: e.g. "RESEARCH-CRYPTO-1 found 3 valid opps with real data"]

## What failed or was incomplete
[honest 1–3 bullets: e.g. "EXECUTION-1 used 17 steps — prompt too loose"]

## Open items for next cycle
- [ref: opp-id] [description] [action needed]

## Carry-forward context
[anything the next cycle must know: pending tests, retry needed, model issues]

## Priority for next cycle
1.
2.
3.
```

Be completely honest. If an agent produced weak output, say it. If QC gave FAIL, carry that forward.
A handoff that says everything was perfect when QC shows failures is itself a failure.
"""
