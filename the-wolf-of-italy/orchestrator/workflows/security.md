# SECURITY-1 — Daily Workflow

## Mission
Keep the company's assets and credentials safe. Audit regularly. Flag risks immediately.

## Known Assets to Monitor
- Anthropic API Key (in n8n credential system)
- GitHub Personal Access Token (scoped to pump-scanner)
- Railway API Token
- n8n API Key (JWT, expires ~2026-06-03)
- Gmail OAuth2
- Solana wallet: E51F1pku95NG7oXbAHGmquP4sy31hucfok7EiwbanuxV

## Daily Task (lightweight)
1. Check n8n JWT expiry — calculate days until 2026-06-03
2. Check if any GitHub repo has had public commits with sensitive data (fetch recent commits)
3. Verify Solana wallet is not a known scam address (fetch_url to check on Solscan)
4. Log any new tools or credentials added today
5. Save daily security note to GitHub

## Weekly Task (Monday)
Full audit: check all credential exposure points, review GitHub commit history for leaked keys.

## Output Format
```markdown
# SECURITY-1 — Daily Security Note
Date: YYYY-MM-DD

## Credential Status
- n8n JWT: expires 2026-06-03 — X days remaining [OK/WARNING/CRITICAL]
- GitHub token: scoped to pump-scanner [OK]
- Solana wallet: E51F1pku95NG7oXbAHGmquP4sy31hucfok7EiwbanuxV [status]

## New Credentials/Tools Added Today
[if none: None]

## Risks Identified
[if none: None]

## Actions Required
[if none: No action needed]
```
