# Pending Decisions — Dashboard ANALISTA
Ultimo aggiornamento: 2026-04-25 03:45 Rome

**Stato corrente: 0/5 BP in dashboard.** 🎯 Dashboard vuota.

---

## Analisi Run 2026-04-25 03:45

### Step 1 — opportunities/2026-04-24.md
- `opportunities/2026-04-24.md` → **404 Not Found** (file inesistente)
- Nessuna opportunità da processare per questa data

### Step 1b — opportunities/2026-04-25.md (esistente ma placeholder)
- File presente ma contiene solo: "Nessuna opportunità ancora analizzata. In attesa del run Hunter di domani (07:00)."
- [fonte: https://raw.githubusercontent.com/nicolostancato-web/pump-scanner/main/the-wolf-of-italy/knowledge_base/opportunities/2026-04-25.md]
- Nessun BP reale da analizzare

### Step 2 — pending_decisions.md pre-esistente
- Ultimo aggiornamento: 2026-04-25 03:34 Rome (run precedente, ~11 min fa)
- Stato: 0/5 BP — nessun BP in coda di decisione
- [fonte: https://raw.githubusercontent.com/nicolostancato-web/pump-scanner/main/the-wolf-of-italy/knowledge_base/analysis/pending_decisions.md]

### Step 3 — Aggiunta nuovi BP
- Nessun nuovo BP da aggiungere (opportunities/2026-04-24.md = 404, opportunities/2026-04-25.md = placeholder)
- Dashboard resta 0/5

### Step 4 — parked/ BP scadenti
- `knowledge_base/parked/` → **404 Not Found** (directory non ancora creata)
- Nessun BP parcheggiato da recuperare

### Step 5 — decisions_queue.md
- File esistente ma **vuoto** — svuotato da ANALISTA run 2026-04-24 13:24 (7 decisioni REJECTED processate)
- [fonte: https://raw.githubusercontent.com/nicolostancato-web/pump-scanner/main/the-wolf-of-italy/knowledge_base/analysis/decisions_queue.md]
- Nessuna decisione da processare

### Step 6 — Reset serale
- Orario: 03:45 Roma (reset alle 22:00)
- **Non in reset serale** — nessuna azione di reset

---

## Cross-citation (dati altri agenti) — 2026-04-25 03:45

- **active_positions.md** (CFO, ultimo agg. 01:08):
  - 1 posizione attiva (BP-2026-04-23-001 JupSOL), valore $17.24 (+0.2% dal deploy)
  - Portfolio totale: **$52.11**
  - Cash libero: **$34.87** (0.404526925 SOL @ $86.21/SOL)
  - [fonte: https://raw.githubusercontent.com/nicolostancato-web/pump-scanner/main/the-wolf-of-italy/knowledge_base/portfolio/active_positions.md]

- **seen_protocols.md** (ANALISTA run 14:26 2026-04-24):
  - 3 BP (KAT, CHIP, SKR) tutti con stato **REJECTED** per decisione dashboard
  - [fonte: https://raw.githubusercontent.com/nicolostancato-web/pump-scanner/main/the-wolf-of-italy/knowledge_base/analysis/seen_protocols.md]

- **decisions_queue.md**: Vuota — ultimo svuotamento 2026-04-24 13:24 (7 decisioni REJECTED processate)
  - [fonte: https://raw.githubusercontent.com/nicolostancato-web/pump-scanner/main/the-wolf-of-italy/knowledge_base/analysis/decisions_queue.md]

- **security_state.md**: **404 Not Found** (file non ancora creato — SECURITY agent non ha ancora eseguito run)

- **Hunter run**: Atteso alle 07:00 Rome oggi (~3h 15min) — nuove opportunità in arrivo
- **Reset serale**: 22:00 Rome

---

## Prossimi eventi

- **Hunter run**: 07:00 Rome oggi (~3h 15min) — nuove opportunità in arrivo
- **Reset serale**: 22:00 Rome

---

**AUDIT: 0 BP letti da opportunities (2026-04-24 = 404, 2026-04-25 = placeholder), 0 nuovi BP aggiunti a dashboard (nessuna opportunità da Hunter ancora), 0 decisioni processate (queue vuota), pending corrente: 0/5.**
