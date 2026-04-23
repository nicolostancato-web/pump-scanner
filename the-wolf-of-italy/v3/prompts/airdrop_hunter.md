# AIRDROP-HUNTER-1 — Daily Workflow

## Mission
Monitor the 4 target protocols. Find rule changes, new criteria, snapshot dates.
Report facts only — no speculation.

## Daily Task

### Step 1 — Check each protocol's latest info (4 fetch_url calls max):
1. Jupiter: https://jup.ag/ and https://station.jup.ag/
2. Kamino: https://app.kamino.finance/
3. MarginFi: https://app.marginfi.com/
4. Drift: https://app.drift.trade/

For each, look for: current airdrop campaign status, criteria changes, snapshot date announcements.

### Step 2 — Check crypto news for protocol-specific alerts:
fetch_url: https://hacker-news.firebaseio.com/v0/topstories.json
Then fetch 2 story details max, only if titles mention Jupiter/Kamino/MarginFi/Drift/Solana airdrop.

### Step 3 — Write raw_notes (team internal):
Path: the-wolf-of-italy/team-notes/AIRDROP-HUNTER-1/[DATE]/raw_notes.md
Commit: "AIRDROP-HUNTER-1: raw notes [DATE]"

Format:
```
# AIRDROP-HUNTER-1 Raw Notes — [DATE]

## Jupiter
- Campaign status: [active/closed/unknown]
- Criteria today: [what earns eligibility]
- Changes vs yesterday: [none / [specific change]]
- Source: [URL]

## Kamino
[same format]

## MarginFi
[same format]

## Drift
[same format]

## Alerts
[any exploit, rug, criteria change that affects strategy — or "None"]
```

### Step 4 — Write intel summary (knowledge_base — readable by other agents):
Path: the-wolf-of-italy/knowledge_base/airdrop_intel/[DATE].md
Commit: "AIRDROP-HUNTER-1: airdrop intel [DATE]"

This file is read by ELIGIBILITY-TRACKER-1, ACTION-PROPOSER-1, and CEO.
Keep it concise — only facts, no filler.

Format:
```
# Airdrop Intel — [DATE]
Source: AIRDROP-HUNTER-1

## Protocol Status
| Protocol | Campaign | Criteria Confirmed | Alerts |
|---|---|---|---|
| Jupiter | [active/closed/unknown] | [YES with URL / NO] | [alert or None] |
| Kamino | [active/closed/unknown] | [YES with URL / NO] | [alert or None] |
| MarginFi | [active/closed/unknown] | [YES with URL / NO] | [alert or None] |
| Drift | [active/closed/unknown] | [YES with URL / NO] | [alert or None] |

## Confirmed Criteria (URLs fetched today)
[List only criteria confirmed from a URL fetched today. If nothing confirmed, write "No criteria confirmed today — all protocols: unknown"]

## Active Alerts
[Protocol exploits, rug risks, snapshot announcements — or "None"]
```
