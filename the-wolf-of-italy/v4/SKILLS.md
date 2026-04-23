# COME USARE QUESTO FILE

Ogni agente **deve leggere questo file all'inizio di ogni run** prima di produrre output.

- Skill **[AUTO]**: si applicano sempre — integrate nel blocco SKILL STANDARD di ogni prompt
- Skill **[CONFIG]**: richiedono un parametro numerico in `v4/config.yaml`
- Skill **[HUMAN]**: richiedono decisione strategica del fondatore (non procedere senza)

Il blocco SKILL STANDARD è già scritto in testa ad ogni file di prompt in `v4/prompts/`.
Le skill [CONFIG] usano i valori da config.yaml al runtime.

---

# SKILL MANUAL — Wolf of Italy v4

## 1. PROOF OF WORK [AUTO]

> Logga ogni chiamata HTTP fatta durante il run.

**Come applicare**: includi nell'output finale una sezione AUDIT con:
- ogni URL fetchato (con status code e breve esito)
- esempio: `GET https://defillama.com/... → 200 OK`

**Obiettivo**: rendere ogni run tracciabile e verificabile dal fondatore senza aprire i log.

---

## 2. SOURCE CITATION [AUTO]

> Ogni claim fattuale richiede [fonte: url].

**Come applicare**: mai scrivere un numero, dato o stato senza citare la fonte.
- ✅ `TVL Jupiter: $2.1B [fonte: https://api.llama.fi/tvl/jupiter]`
- ❌ `Il TVL di Jupiter è circa $2B`

**Obiettivo**: zero dati inventati. Il fondatore deve poter verificare ogni affermazione in 10 secondi.

---

## 3. HONEST OUTPUT [AUTO]

> Se non trovi nulla, dillo esplicitamente.

**Come applicare**:
- Se un fetch restituisce 404 → scrivi "non trovato (404)"
- Se un protocollo non supera i filtri → spiega quale filtro ha fallito
- Se non ci sono opportunità oggi → salva "Nessuna opportunità trovata" con lista fonti controllate
- Mai inventare, approssimare, o omettere dati mancanti

**Obiettivo**: output falso è peggio di output vuoto.

---

## 4. CROSS-CITATION [AUTO]

> Cita min 2 dati da file di altri agenti (se presenti).

**Come applicare**: all'avvio, leggi almeno 2 di questi file e cita i dati rilevanti nel tuo output:
- `active_positions.md` → scritto da CFO
- `pending_decisions.md` → scritto da ANALISTA
- `security_state.md` → scritto da SECURITY
- `monitor/[DATE].md` → scritto da MONITOR

Esempio: "Cross-check: CFO riporta portfolio $52.17, SECURITY ultima verifica 3h fa — dati coerenti."

**Obiettivo**: ogni agente conosce lo stato degli altri, nessun agente opera in isolamento.

---

## 5. CHAIN OF THOUGHT [AUTO]

> Ragiona step-by-step prima della risposta finale.

**Come applicare**: prima di ogni azione importante, scrivi (anche internamente):
1. Cosa devo fare in questo step
2. Cosa ho trovato
3. Quale decisione prendo e perché

Non serve esporre tutto il ragionamento nell'output finale, ma struttura il processo prima di agire.

**Obiettivo**: evitare salti logici, decisioni impulsive, errori di sequenza.

---

## 6. SELF-CRITIQUE [AUTO]

> Rivedi il tuo output e correggi errori logici prima di salvare.

**Come applicare**: prima di chiamare `github_save`, chiediti:
- Tutti i dati sono citati con fonte?
- Il formato del file rispetta le specifiche del prompt?
- Ho cross-citato dati da altri agenti?
- C'è qualcosa che non torna (es. portfolio_total < cash_free)?
- Ho superato il budget o le iterazioni?

Correggi prima di salvare. Non è possibile fare commit retroattivo.

**Obiettivo**: zero file rotti nel knowledge base.

---

## 7. MAX ITERATIONS [CONFIG: max_iter]

> Fermati dopo max_iter tool calls totali in questo run.

**Valore**: vedi `v4/config.yaml` → `agents.[nome_agente].max_iterations`
- Se config non disponibile → default: 20 tool calls

**Come applicare**: conta ogni `fetch_url`, `github_save`, `get_sol_balance` come 1 iterazione.
Quando raggiungi il limite → salva lo stato parziale con nota "STOP: max_iterations raggiunto".

**Obiettivo**: prevenire loop infiniti e costi non controllati.

---

## 8. BUDGET [CONFIG: max_cost]

> Fermati se superi max_cost $ in questo run.

**Valore**: vedi `v4/config.yaml` → `agents.[nome_agente].max_cost_per_run`
- Se config non disponibile → default: $0.10

**Come applicare**: stima costo LLM corrente (input + output tokens × prezzo modello).
DeepSeek: $0.14/M input, $0.28/M output (valori approssimativi).
Se proiezione supera il budget → salva stato parziale e termina.

**Obiettivo**: ogni agente opera entro un tetto di costo prevedibile.

---

## Tabella Riepilogo

| # | Skill | Tag | Parametro Config |
|---|---|---|---|
| 1 | PROOF OF WORK | [AUTO] | — |
| 2 | SOURCE CITATION | [AUTO] | — |
| 3 | HONEST OUTPUT | [AUTO] | — |
| 4 | CROSS-CITATION | [AUTO] | — |
| 5 | CHAIN OF THOUGHT | [AUTO] | — |
| 6 | SELF-CRITIQUE | [AUTO] | — |
| 7 | MAX ITERATIONS | [CONFIG] | `agents.*.max_iterations` |
| 8 | BUDGET | [CONFIG] | `agents.*.max_cost_per_run` |

---

## Skill [HUMAN] — Richiedono Decisione Fondatore

Queste decisioni NON sono automatizzabili. Richiedono input esplicito in config.yaml:

- **Quale modello LLM fallback** quando DeepSeek è down?
- **Tetto costo mensile totale** (Railway + LLM)?
- **Soglia alert portfolio drop 24h** (default suggerito: -20%)?
- **Limite BP parcheggiati** prima di forzare archiviazione (default suggerito: 10)?
- **Limite BP dashboard** (default suggerito: 5)?
- **Giorni preavviso scadenza API key** (default suggerito: 7)?
- **Quali agenti aggiungere** nella prossima release?

Vedi sezione `???` in `v4/config.yaml` — ogni placeholder richiede risposta.
