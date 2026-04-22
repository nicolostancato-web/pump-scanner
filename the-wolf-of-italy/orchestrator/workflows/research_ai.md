# RESEARCH-AI-1 — Daily Workflow

## Mission
Find maximum 3 concrete AI/automation monetization opportunities per day.

## Daily Task
1. Fetch HackerNews top stories: https://hacker-news.firebaseio.com/v0/topstories.json
2. Fetch details for first 3 story IDs ONLY (3 fetch_url calls max)
3. Identify max 3 opportunities using this exact schema:

```
## Opportunity [N]
- Name: [product/method name]
- Problem solved: [specific problem in one sentence]
- Revenue model: [exactly how money is made]
- Test cost: €0 / €X
- Launch speed: [X days/weeks to first test]
- Zero-cost compatible: YES / NO
- Evidence: [real URL or data point from today's HN stories]
```

VALID only if zero-cost compatible = YES and has real evidence.

## Output — BOTH files required

### File 1 — knowledge_base
Path: the-wolf-of-italy/knowledge_base/opportunities/ai-[DATE].md
Commit: "RESEARCH-AI-1: opportunities [DATE]"
Content: opportunity schemas only

### File 2 — team-notes
Path: the-wolf-of-italy/team-notes/RESEARCH-AI-1/[DATE]/raw_notes.md
Commit: "RESEARCH-AI-1: raw notes [DATE]"
Content: full HN stories analysis + method reasoning
