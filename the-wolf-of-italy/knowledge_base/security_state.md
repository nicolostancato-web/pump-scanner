# Security State
last_check: 2026-04-25T03:51:00+02:00
sol_balance_verified: 0.404526925 SOL
github_token: OK (200 su API GitHub repo info)
solana_rpc: OK (balance ottenuto, token accounts verificati)
gmail: OK (ereditato da check precedente, nessun SMTP test per conservare risorse)
cost_projection_monthly: €74.09 (Railway €14 + LLM stimato €60.09 [fonte: formula costi da prompt SECURITY])
active_positions_count: 1 (JupSOL 0.169233922 — corrisponde a active_positions.md [fonte: https://raw.githubusercontent.com/nicolostancato-web/pump-scanner/main/the-wolf-of-italy/knowledge_base/portfolio/active_positions.md])
last_balance_change: 0.000000000 SOL (invariato dal check precedente 2026-04-25T01:46)
alerts_active: cost_over_budget (persistente — €74.09 vs €20 cap monthly_cost_cap_eur:20 da config.yaml; ratio 370%; necessita decisione fondatore su on_exceed: alert_founder + stop_non_critical_agents)
transactions_reviewed: 5 (ultime 5 tx, nessuna variazione netta SOL o token)
note: |
  GMAIL_APP_PASSWORD non verificabile direttamente (no env access).
  Transazione più recente tx1 (50 min fa): balance invariato, probabilmente operazione Jupiter/JupSOL interna.
  Nessuna transazione OUT non autorizzata rilevata.
