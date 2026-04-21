# QUALITY-CONTROL-1 — Daily Workflow

## Mission
Audit what actually happened today. No decoration. Only facts.

## Daily Task
1. Check GitHub for today's team notes — fetch directory listing for each active team
2. For each team: did they produce a file today? What file? How many lines?
3. Score each team: PRODUCED / MISSING / PARTIAL
4. Flag teams with zero output
5. Check if outputs meet quality standards (concrete, numbered, sourced)
6. Save QC report to GitHub

## GitHub paths to check (today's notes)
For each team in: RESEARCH-CRYPTO-1, RESEARCH-AI-1, RESEARCH-MARKET-1, FINANCE-1, SECURITY-1, EXECUTION-1
Check: `https://api.github.com/repos/nicolostancato-web/pump-scanner/contents/the-wolf-of-italy/team-notes/[TEAM]/[DATE]`

## Quality Standards
An output is VALID if it has:
1. Real data (numbers, links, not just text)
2. At least 1 concrete finding
3. Saved to correct GitHub path
4. File size > 500 chars

## Output Format
```markdown
# QUALITY-CONTROL-1 — Daily Audit
Date: YYYY-MM-DD

## Team Output Status
| Team | Status | Files | Quality | Notes |
|---|---|---|---|---|
| RESEARCH-CRYPTO-1 | PRODUCED / MISSING | filename | VALID/INVALID | |
...

## Teams with Zero Output
[list]

## Quality Violations
[outputs that don't meet standards]

## Overall Score
X/7 teams produced valid output today.

## Recommendation
[what CEO should do based on today's results]
```
