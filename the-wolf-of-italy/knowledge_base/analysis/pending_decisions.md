ANALISTA — 2026-04-24 16:32 Rome
# BP in attesa di decisione (0/5)

## Stato corrente dashboard
- **opportunities/2026-04-24.md**: 404 — file non esistente [fonte: GET opportunities/2026-04-24.md → 404]
- **Nessun nuovo BP da aggiungere**: opportunities/2026-04-24.md non esiste
- **decisions_queue.md**: Vuota — nessuna decisione in coda [fonte: GET decisions_queue.md → decoded, header only]
- **parked/**: 404 — directory non creata, nessun BP parcheggiato [fonte: GET parked/ → 404]
- **seen_protocols.md**: 3 protocolli (KAT, CHIP, SKR) tutti REJECTED — già processati nel run 13:24 [fonte: seen_protocols.md decoded]
- **active_positions.md (CFO)**: 404 — CFO non ha ancora creato file [fonte: GET active_positions.md → 404]
- **security_state.md (SECURITY)**: 404 — SECURITY non ha ancora creato file [fonte: GET security_state.md → 404]

## Decisioni per questo run
- **Nessun nuovo BP da aggiungere**: opportunities/2026-04-24.md 404; crypto-2026-04-24.md conteneva 3 BP già processati e REJECTED
- **Nessuna decisione da processare**: decisions_queue.md vuota
- **Nessun BP parcheggiato**: directory parked/ non esiste
- **Reset serale**: Non applicabile (ora 16:32 Roma, reset a 22:00) [fonte: config.yaml → evening_reset_time: "22:00"]

## Cross-check
- seen_protocols.md conferma 3 protocolli REJECTED (KAT, CHIP, SKR) processati nel run 13:24 [fonte: seen_protocols.md decoded]
- decisions_queue.md svuotata da ANALISTA run 13:24 con 7 decisioni REJECTED [fonte: decisions_queue.md decoded]
- CFO (active_positions.md) e SECURITY (security_state.md): file non ancora creati — nessun dato da cross-citare

## Audit
- GET SKILLS.md → 200 OK
- GET config.yaml → 200 OK
- GET opportunities/2026-04-24.md → 404
- GET pending_decisions.md → 200 OK (decoded, 0/5)
- GET parked/ → 404
- GET decisions_queue.md → 200 OK (vuota)
- GET seen_protocols.md → 200 OK (3 REJECTED)
- GET active_positions.md → 404
- GET security_state.md → 404
- github_save pending_decisions.md → salvato (timestamp 16:32)
AUDIT: 0 BP letti da opportunities (404), 0 BP aggiunti a dashboard (nessuna opportunità), 0 decisioni processate (queue vuota), pending corrente: 0/5
