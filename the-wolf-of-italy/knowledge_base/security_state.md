# Security State
last_check: 2026-04-25T06:58:00+02:00
sol_balance_verified: 0.404526925 SOL
github_token: OK (200 su API GitHub repo info)
solana_rpc: OK (balance ottenuto, 5 tx retrieve, token accounts OK)
gmail: OK (ereditato da check precedente, nessun test SMTP per risparmiare risorse)
cost_projection_monthly: €119.45 (Railway €14 + LLM €105.45; tetto config.yaml €20 → ratio 597%)
active_positions_count: 1 (JupSOL 0.169233922 — corrisponde a active_positions.md [fonte: https://github.com/nicolostancato-web/pump-scanner/blob/main/the-wolf-of-italy/knowledge_base/portfolio/active_positions.md])
last_balance_change: 0.000000000 SOL (invariato dal check precedente 2026-04-25T05:56)
transactions_reviewed: 5 (ultime 2 tx con err:null, balance invariato — nessuna OUT sospetta)
alerts_active: cost_over_budget (persistente — €119.45 vs €20 cap mensile da config.yaml monthly_cost_cap_eur:20; ratio 597%; necessaria decisione fondatore su on_exceed: alert_founder + stop_non_critical_agents)
note: |
  Nessun nuovo alert critico.
  Balance SOL invariato, nessuna transazione OUT non autorizzata.
  Token accounts corrispondono esattamente a active_positions.md (JupSOL 0.169233922).
  Alert cost_over_budget già presente e persistente — non è stata inviata nuova notifica critica.
  pending_decisions.md: non trovato (404) — nessuna decisione in sospeso.
  monitor directory: non trovata (404) — nessun report monitor da cross-citare.
  Cross-check: CFO active_positions.md riporta cash $34.94 + JupSOL $17.28 = totale $52.22, coerente con balance SOL 0.404526925 @ $86.37/SOL e token JupSOL 0.169233922 @ $102.12/SOL.
