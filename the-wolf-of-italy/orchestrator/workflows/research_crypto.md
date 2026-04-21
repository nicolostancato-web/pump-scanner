# RESEARCH-CRYPTO-1 — Daily Workflow

## Mission
Fetch real crypto market data every day. Identify concrete signals and opportunities.

## Tools to use
- `coingecko_trending` — top trending coins
- `coingecko_markets` — top 20 by volume with 24h change
- `fetch_url` — for additional free sources
- `github_save` — save all output

## Daily Task
1. Call `coingecko_trending` → get trending list
2. Call `coingecko_markets` with limit=20 → get movers
3. Optionally fetch DeFiLlama: `https://api.llama.fi/protocols` for TVL data
4. Analyze: find top 3 signals (volume spikes, trending narratives, unusual moves)
5. Identify at least 1 concrete opportunity with: mechanism, risk, capital needed, next step
6. Save to GitHub

## Output Format
```markdown
# RESEARCH-CRYPTO-1 — Raw Notes
Date: YYYY-MM-DD | Source: CoinGecko (free)

## Trending Coins
[list with name, symbol, rank, score]

## Top Movers (24h)
[list with name, price, % change, volume]

## Signals Identified
1. [signal with data]
2. [signal with data]
3. [signal with data]

## Opportunity Identified
Name: 
Mechanism: how it makes money
Capital needed: 
Risk: low/medium/high + why
Time to first result:
Next step:

## Sources
[links used]
```

## Quality Criteria
- Must have real numbers from API (not invented)
- At least 1 opportunity per day
- All sources linked
