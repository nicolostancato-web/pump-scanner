# Pending Decisions — Dashboard ANALISTA
Ultimo aggiornamento: 2026-04-25 06:31 Rome
**Stato corrente: 0/5 BP in dashboard.** 🀄 Dashboard vuota.
Nessun BP in attesa di decisione. Nuove opportunità in arrivo dal run Hunter delle 07:00.

## Cross-Citation (dati altri agenti) — 2026-04-25 06:31
- **active_positions.md** (CFO, ultimo aggiornamento 2026-04-25 05:09):
  - 1 posizione attiva: BP-2026-04-23-001 JupSOL (FULLY_DEPLOYED), valore $17.28 (+0.5%)
  - Portfolio totale: **$52.22**
  - Cash libero: **$34.94** (0.404526925 SOL @ $86.37/SOL)
  - [fonte: https://raw.githubusercontent.com/nicolostancato-web/pump-scanner/main/the-wolf-of-italy/knowledge_base/portfolio/active_positions.md]
- **seen_protocols.md** (ANALISTA, ultimo aggiornamento 2026-04-24 14:26):
  - 3 BP processati: KAT (REJECTED), CHIP (REJECTED), SKR (REJECTED)
  - [fonte: https://raw.githubusercontent.com/nicolostancato-web/pump-scanner/main/the-wolf-of-italy/knowledge_base/analysis/seen_protocols.md]
- **decisions_queue.md**: Vuota (svuotata da ANALISTA 2026-04-24 13:24) [fonte: raw content decoded]
- **parked/**: Directory non esistente (404) [fonte: GET contents/knowledge_base/parked → 403 rate limit, pending_decisions.md run precedente conferma 404]
- **security_state.md**: Non ancora creato (404)
- **monitor/2026-04-25.md**: Non ancora creato (404)
- **pending_deployment.md**: Non ancora creato (404)

## Log Run 2026-04-25 06:31
- **SKILLS.md** → letto con successo (200 OK) — skill [AUTO] applicate ✅
- **config.yaml** → letto con successo (200 OK) — max_iterations: default 20, max_cost_per_run: ~$0.05
- **opportunities/2026-04-24.md** → 404 (non trovato)
- **pending_decisions.md** → letto (200 OK), stato corrente: 0/5 ✅
- **decisions_queue.md** → letto (200 OK), vuota ✅
- **parked/** → 403 rate limit su API GitHub; da run precedente risultava 404 (directory non esistente)
- **active_positions.md** → letto (200 OK) — CFO aggiornato 05:09 ✅
- **seen_protocols.md** → letto (200 OK) — 3 BP REJECTED ✅

## Decisioni Processate
Nessuna decisione in coda da processare.

## BP Aggiunti alla Dashboard
Nessuno — nessuna opportunità disponibile (Hunter non ancora eseguito per oggi).

## Note
- Opportunità del 24/04 (KAT, CHIP, SKR) già processate e REJECTED nel run del 24/04 13:24
- In attesa del run Hunter delle 07:00 per nuove opportunità del 25/04
- Reset serale non richiesto (orario: 06:31, reset previsto 22:00)

*AUDIT: 0 BP letti da opportunities (404 file 24/04, Hunter non ancora eseguito per 25/04), 0 BP aggiunti a dashboard, 0 decisioni processate (queue vuota), pending corrente: 0/5.*
