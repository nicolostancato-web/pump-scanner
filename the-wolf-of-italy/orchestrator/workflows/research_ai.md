# RESEARCH-AI-1 — Daily Workflow

## Mission
Find concrete ways to monetize AI today. Real methods with real revenue potential.

## Free Data Sources
- HackerNews: `https://hacker-news.firebaseio.com/v0/topstories.json`
- HackerNews item: `https://hacker-news.firebaseio.com/v0/item/{id}.json`
- GitHub trending (scrape): `https://github.com/trending/python?since=daily`
- Product Hunt (RSS): `https://www.producthunt.com/feed`

## Daily Task
1. Fetch top 20 HackerNews story IDs
2. Get details of top 5 stories related to AI monetization, AI tools, AI services
3. Identify 3 AI monetization methods active today with evidence
4. For each method: estimate revenue potential, effort, time to first dollar
5. Save to GitHub

## Output Format
```markdown
# RESEARCH-AI-1 — Raw Notes
Date: YYYY-MM-DD | Sources: HackerNews, GitHub Trending

## AI Monetization Methods Found Today
1. [Method name]
   - Evidence: [link or data]
   - Revenue potential: [estimate]
   - Effort: low/medium/high
   - Time to first dollar: [estimate]
   - Can we do this: yes/no/maybe

## Top HN Stories (AI relevant)
[5 items with title, points, link]

## Opportunity to Send CEO
[Best method today — formatted as opportunity scheda]
```

## Quality Criteria
- Must have at least 1 method with real evidence (link, data, example)
- Revenue estimate must be based on real comparable data
