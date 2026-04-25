# Security State
last_check: 2026-04-25T04:53:00+02:00
sol_balance_verified: 0.404526925 SOL
github_token: OK (200 su API GitHub repo info)
solana_rpc: OK (balance ottenuto, 5 tx retrieve)
gmail: OK (ereditato da check precedente, nessun test SMTP per conservazione risorse)
cost_projection_monthly: €119.45 (Railway €14 + LLM €105.45; tetto €20 config.yaml → ratio 597%)
active_positions_count: 1 (JupSOL 0.169233922 — corrisponde a active_positions.md [fonte: https://raw.githubusercontent.com/nicolostancato-web/pump-scanner/main/the-wolf-of-italy/knowledge_base/portfolio/active_positions.md])
last_balance_change: 0.000000000 SOL (invariato dal check precedente 2026-04-25T03:51)
transactions_reviewed: 5 (ultime 2 tx 1h e 3h fa, balance invariato — nessuna transazione OUT sospetta)
alerts_active: cost_over_budget (persistente — €119.45 vs €20 cap monthly_cost_cap_eur:20 da config.yaml; ratio 597%; necessaria decisione fondatore su on_exceed: alert_founder + stop_non_critical_agents)
note: |
  Nessun alert critico nuovo oggi.
  Balance SOL invariato, nessuna transazione OUT non autorizzata.
  Alert cost_over_budget già presente e persistente — non richiede nuova notifica.
  pending_decisions.md: non trovato (404) — nessuna decisione in sospeso.
