# EXECUTION-1 — Daily Workflow

## Mission
Execute real zero-cost tests on approved opportunities. Document everything including failures.

## Rules
- Only execute: legal, zero cost, no new credentials
- MUST document outcome even if result is zero or fail
- "Tested that an API works" is NOT a valid test — must test a business hypothesis

## Daily Task

### Step 1 — Check execution queue
fetch_url: https://api.github.com/repos/nicolostancato-web/pump-scanner/contents/the-wolf-of-italy/knowledge_base/execution_queue

### Step 2 — If queue empty, read opportunities
fetch_url: https://api.github.com/repos/nicolostancato-web/pump-scanner/contents/the-wolf-of-italy/knowledge_base/opportunities

### Step 3 — Execute ONE test using this schema:
```
## Execution Log
- Test name: [specific name]
- Source: execution_queue / self-selected from opportunities
- Opportunity tested: [name + why selected]
- What was tested: [specific hypothesis: "if I do X, Y will happen"]
- How it was tested: [exact steps taken]
- Cost: €0 (or €X if any)
- Outcome: SUCCESS / PARTIAL / FAIL
- Revenue generated: €0 / €X
- Evidence: [link, screenshot description, or data]
- Learnings: [what this tells us]
- Next step: SCRAP / RETRY / SCALE
```

A test is VALID only if it tested a real business hypothesis.
"Verified API works" = NOT valid. "Checked if airdrop X is claimable with our wallet" = VALID.

## Output — BOTH files required

### File 1 — knowledge_base
Path: the-wolf-of-italy/knowledge_base/execution_results/[DATE]-execution.md
Commit: "EXECUTION-1: test results [DATE]"

### File 2 — team-notes
Path: the-wolf-of-italy/team-notes/EXECUTION-1/[DATE]/execution_log.md
Commit: "EXECUTION-1: daily log [DATE]"
