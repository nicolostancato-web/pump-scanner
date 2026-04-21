# RESEARCH-MARKET-1 — Daily Workflow

## Mission
Monitor free public sources for AI + crypto market signals. Find early-stage trends.

## Tools to use
- `fetch_url` — for HackerNews, DeFiLlama, free RSS feeds
- `github_save` — save all output

## Free Data Sources
- HackerNews top stories: `https://hacker-news.firebaseio.com/v0/topstories.json`
- HackerNews item: `https://hacker-news.firebaseio.com/v0/item/{id}.json`
- DeFiLlama protocols: `https://api.llama.fi/protocols`
- DeFiLlama chains: `https://api.llama.fi/v2/chains`
- CoinGecko news: `https://api.coingecko.com/api/v3/news`

## Daily Task
1. Fetch HackerNews top 20 story IDs
2. Get details of top 5 most relevant to AI or crypto
3. Fetch DeFiLlama top protocols by TVL
4. Identify 3 market signals relevant to profit opportunities
5. Save to GitHub

## Output Format
```markdown
# RESEARCH-MARKET-1 — Raw Notes
Date: YYYY-MM-DD

## Top News (AI + Crypto)
[5 items with title, source, link, relevance]

## DeFiLlama Top Protocols
[top 10 by TVL with change]

## Market Signals
1. [signal + data + implication]
2. [signal + data + implication]
3. [signal + data + implication]

## Actionable Intelligence
[1 concrete recommendation with rationale]
```
