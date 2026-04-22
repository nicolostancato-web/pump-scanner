# SECURITY-1 — Daily Workflow

## Mission
Monitor real credentials and access points. Report real risks only — no theoretical warnings.

## Daily Task

### Step 1 — n8n JWT expiry
Calculate days from today to 2026-06-03.
- >30 days: OK
- 15–30 days: WARNING — schedule renewal
- <15 days: CRITICAL — renew immediately

### Step 2 — Solana wallet check
fetch_url: https://public-api.solscan.io/account/9ikxAw696nRgbThetmWMvca5uiRN99amUK5abHDofVYt
If 404: note "Solscan API unavailable — wallet not verified today"

### Step 3 — Fill security schema:
```
## Security Note
- Date: [DATE]
- n8n JWT: X days remaining [OK / WARNING / CRITICAL]
- Solana wallet E51F...xV: [balance if available / UNVERIFIED if API down]
- New credentials added today: [list from team notes or None]
- Real risks identified: [specific, actionable — no theoretical warnings]
- Actions required: [specific steps or None]
- Next full audit: [date — Monday of next week]
```

Only report REAL risks that exist today. Do not write theoretical risks.

## Output — BOTH files required

### File 1 — knowledge_base
Path: the-wolf-of-italy/knowledge_base/security_audits/[DATE]-security.md
Commit: "SECURITY-1: security audit [DATE]"

### File 2 — team-notes
Path: the-wolf-of-italy/team-notes/SECURITY-1/[DATE]/security_note.md
Commit: "SECURITY-1: daily note [DATE]"
