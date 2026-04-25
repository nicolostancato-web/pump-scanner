# Pending Decisions — Dashboard ANALISTA
Ultimo aggiornamento: 2026-04-25 03:34 Rome

**Stato corrente: 0/5 BP in dashboard.** 🎯 Dashboard vuota.

---

## Analisi Run 2026-04-25 03:34

### Step 1 — opportunities/2026-04-25.md
- `opportunities/2026-04-25.md` → **Esiste ma è un placeholder** (creato da reset serale 2026-04-24 22:00)
- Contenuto: "Nessuna opportunità ancora analizzata. In attesa del run Hunter di domani (07:00)."
- [fonte: https://raw.githubusercontent.com/nicolostancato-web/pump-scanner/main/the-wolf-of-italy/knowledge_base/opportunities/2026-04-25.md]

### Step 2 — pending_decisions.md pre-esistente
- Ultimo aggiornamento: 2026-04-25 03:28 Rome (run precedente, 6 min fa)
- Stato: 0/5 BP — nessun BP in coda di decisione

### Step 3 — Aggiunta nuovi BP
- Nessun nuovo BP da aggiungere (opportunities/2026-04-25.md è placeholder, nessun BP analizzato da Hunter)
- Dashboard resta 0/5

### Step 4 — parked/ BP scadenti
- `knowledge_base/parked/` → **404 Not Found** (directory non ancora creata)
- Nessun BP parcheggiato da recuperare

### Step 5 — decisions_queue.md
- File esistente ma **vuoto** (svuotato da ANALISTA run 2026-04-24 13:24 con 7 decisioni REJECTED processate)
- [fonte: raw content decisions_queue.md]
- Nessuna decisione da processare

### Step 6 — Reset serale
- Orario: 03:34 Roma (reset alle 22:00)
- **Non in reset serale** — nessuna azione di reset

---

## Cross-citation (dati altri agenti) — 2026-04-25 03:34

- **active_positions.md** (CFO, ultimo agg. 01:08):
  - 1 posizione attiva (BP-2026-04-23-001 JupSOL), valore $17.24 (+0.2% dal deploy)
  - Portfolio totale: **$52.11**
  - Cash libero: **$34.87** (0.404526925 SOL @ $86.21/SOL)
  - [fonte: https://raw.githubusercontent.com/nicolostancato-web/pump-scanner/main/the-wolf-of-italy/knowledge_base/portfolio/active_positions.md]

- **seen_protocols.md** (ANALISTA run 14:26 2026-04-24):
  - 3 BP (KAT, CHIP, SKR) tutti con stato **REJECTED** per decisione dashboard
  - [fonte: https://raw.githubusercontent.com/nicolostancato-web/pump-scanner/main/the-wolf-of-italy/knowledge_base/analysis/seen_protocols.md]

- **decisions_queue.md**: Vuota — ultimo svuotamento 2026-04-24 13:24 (7 decisioni REJECTED)
  - [fonte: https://raw.githubusercontent.com/nicolostancato-web/pump-scanner/main/the-wolf-of-italy/knowledge_base/analysis/decisions_queue.md]

---

## Prossimi eventi

- **Hunter run**: 07:00 Rome oggi (~3h 26min) — nuove opportunità in arrivo
- **Reset serale**: 22:00 Rome

---

**AUDIT: 1 BP letto da opportunities/2026-04-25.md (placeholder, nessuna opportunità reale), 0 nuovi BP aggiunti a dashboard (nessuna nuova opportunità da Hunter), 0 decisioni processate (queue vuota), pending corrente: 0/5.**
