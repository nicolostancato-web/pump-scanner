# Security State
last_check: 2026-04-25T10:03:00+02:00
sol_balance_verified: 0.404526925 SOL
github_token: OK (200 su API GitHub repo info) [fonte: api.github.com/repos/nicolostancato-web/pump-scanner → 200 OK]
solana_rpc: OK (balance ottenuto, 5 tx retrieve, token accounts OK) [fonte: get_sol_balance + get_recent_transactions + get_token_accounts]
gmail: OK (ereditato da check precedente, nessun test SMTP per risparmiare risorse — come da policy)
cost_projection_monthly: €117.20 (Railway €14 + LLM €103.20; tetto config.yaml €20 → ratio 586%)
active_positions_count: 1 (JupSOL 0.169233922 → corrisponde a active_positions.md [fonte: raw.githubusercontent.com/.../active_positions.md])
last_balance_change: 0.000000000 SOL (invariato dal check precedente 2026-04-25T09:03)
transactions_reviewed: 5 (ultima tx blockTime 1776886908 ≈ 2026-04-25 10:01 Roma — err: null — balance invariato, nessuna OUT sospetta) [fonte: get_recent_transactions]
alerts_active: cost_over_budget (persistente — €117.20 vs €20 cap mensile da config.yaml monthly_cost_cap_eur:20; ratio 586%; necessaria decisione fondatore su on_exceed: alert_founder + stop_non_critical_agents)
note: |
  Nessun nuovo alert critico in questo run.
  Balance SOL invariato (0.404526925 SOL), nessuna transazione OUT non autorizzata.
  Token accounts corrispondono esattamente a active_positions.md (JupSOL 0.169233922).
  Alert cost_over_budget persiste dal run precedente — non inviata nuova notifica per evitare spam.
  Cross-check: CFO active_positions.md riporta cash $34.90 + JupSOL $17.32 = totale $52.22. Balance SOL 0.404526925 @ ~$86.28/SOL = $34.90. Coerenza confermata.
  Due transazioni recenti (blockTime 1776886908 e 1776865746) senza impatto su balance — probabili tx 0-SOL o reward non monetizzate.
