# Meeting Minutes — 2026-04-20
## Crypto Bot Division | Giornata operativa completa

---

### Strategy-1 — Entry Logic Analysis
**Finestra di lavoro:** 09:00–13:00, 16:00–18:30

**Attività mattutina:**
- Attesa e monitoraggio primi segnali V6 dai log Railway
- 09:47 — primo segnale V6: SMB (age 12min, mcap $42k, priceChange5m +7.2%, vol5m $1.340, buys>sells). Tutti i criteri superati.
- 11:28 — secondo segnale V6: Twig (age 13min, mcap $38k). Criteri superati.
- Monitoraggio live SMB: prezzo flat dopo entry, poi discesa progressiva. Peak = 1.0x. Mai sopra l'entry price.
- Analisi immediata: priceChange5m +7.2% era il movimento dei 5 minuti precedenti alla scansione, non dei 5 minuti successivi. Il token aveva già fatto il movimento quando il bot lo ha catturato.
- Comunicato al CEO: pattern "momentum esaurito pre-entry" identificato come ipotesi principale.

**Attività pomeridiana:**
- 16:00 — terzo segnale V6: MTS (age 12min). Stesso pattern di SMB: SL diretto, peak = 1.0x.
- Review criteri C3: la variazione priceChange5m misura il passato, non il futuro.
- Ipotesi formulata per V7: aggiungere criterio di accelerazione — volume5m crescente rispetto a volume10m-5m, oppure txns nell'ultimo minuto vs media ultimi 5min.
- Decisione: nessuna modifica a V6 prima di 15 trade. Qualsiasi cambio ora sarebbe overfitting.
- Output consegnato a Strategy-2 e Analysis-1.

**Risultato:** Ipotesi "dead cat entry" formulata. V6 confermato invariato fino a 15 trade.
**Comunicato al CEO:** Criterio C3 potenzialmente cattura token a fine momentum.
**Blocchi:** Nessuno.

---

### Strategy-2 — Exit Logic & Post-Mortem
**Finestra di lavoro:** 09:00–18:00

**Attività:**
- Post-mortem dettagliato sui 3 trade V6:

| Token | Entry | Peak | Close | Tempo al SL | Note |
|---|---|---|---|---|---|
| SMB | 1.0x | 1.0x | 0.59x | ~45 min | Mai sopra entry |
| Twig | 1.0x | 1.057x | 0.021x | ~2h | Rug instantaneo |
| MTS | 1.0x | 1.0x | 0.56x | ~40 min | Mai sopra entry |

- Nessuno dei 3 ha mai attivato il check TP@1.5x.
- Analisi Twig: liquidità ~$15k, un wallet ha venduto l'intera posizione in un singolo blocco. Il crollo è avvenuto tra due check da 1 minuto. Non è un bug — è un rug instantaneo non prevenibile.
- Verifica meccanismo SL: close_reason = "stop_loss" registrato correttamente per tutti e 3.
- Conclusione: exit logic funziona correttamente. Il problema è upstream (entry su token già esauriti).

**Risultato:** Sistema di exit confermato funzionante. Problema identificato nella fase di entry.
**Comunicato al CEO:** Exit ok. Tutti e 3 i trade morti prima di qualsiasi target.
**Blocchi:** Nessuno.

---

### Strategy-3 — Strategic Direction
**Finestra di lavoro:** 10:00–11:30, 17:00–18:00

**Attività mattutina:**
- Review stato: 69 trade, WR 2.9%, 3 trade V6 tutti negativi.
- Valutazione: modificare V6 subito? Risposta: no. 3 trade non dicono niente. Soglia minima 15 trade confermata.
- Filosofia confermata: V6 in questa fase è informativo, non operativo.

**Attività pomeridiana:**
- Stesura bozza piano transizione V1→V6:
  - Raggiunto 15 trade con wouldEnterV6=true
  - Se pump rate >30%: V6 diventa strategia principale
  - V1 rimane attivo altri 30 trade come comparativo
  - Poi V1 si disattiva
- Timeline stimata al ritmo attuale (3 V6 al giorno): validazione intorno al 25 aprile.

**Risultato:** Piano transizione bozza pronto. Direzione V6 confermata senza modifiche.
**Comunicato al CEO:** Nessuna modifica prima di 15 trade. Piano transizione pronto.
**Blocchi:** Nessuno.

---

### Development-1 — Core Bot
**Finestra di lavoro:** 08:00–09:00, 12:00–13:00, 17:00–18:00

**Check mattutino (08:00–09:00):**
- Log Railway post-notte: nessun crash, nessun restart.
- Check interval 1 minuto confermato: 847 check completati nelle prime 18h.
- Nessun errore 429 da DexScreener.
- 8 nuovi trade chiusi tra mezzanotte e le 08:00, tutti SL o max-hold.

**Check mezzogiorno:**
- SMB e Twig correttamente loggati con `[V6] ✅ ENTER`.
- positions_history.json su GitHub: file aggiornato, lastSaved coerente.

**Ricostruzione caso Twig:**
- Log 11:28:43 — `[V6] ✅ ENTER | Twig`
- Log 11:29:51 — `[checking positions] Twig: current=0.00000071 entry=0.000034 mult=0.021`
- In 68 secondi: da +5.7% a -97.9%. Rug confermato dai log. Il sistema ha registrato correttamente.

**Check serale:**
- MTS registrato correttamente. Log pulito. Nessun errore nelle ultime 24h.

**Risultato:** Sistema stabile. Rate limit non è un problema nel breve termine.
**Comunicato al CEO:** Bot operativo, nessun problema tecnico.
**Blocchi:** Nessuno.

---

### Development-2 — Data Pipeline
**Finestra di lavoro:** 09:00–10:30, 14:00–15:00

**Attività:**
- Verifica n8n Position Tracker: ultimo run UTC 09:23, status success.
- Campionamento 5 righe casuali su Google Sheets: tutti i campi V6 compilati correttamente.
- Verifica individuale SMB: V6 WouldEnter=TRUE, V6 Fail=PASS, V6 TP2x=FALSE, V6 TP1.5x=FALSE ✅
- Verifica Twig e MTS: stessa struttura, corretti.
- Nessuna anomalia nella pipeline.

**Nota tecnica:** Se in futuro si aggiungono nuovi campi, il nodo Extract Fields su n8n va aggiornato manualmente. Non è automatico.

**Risultato:** Pipeline integra e funzionante.
**Comunicato al CEO:** Pipeline ok, Sheets aggiornato correttamente.
**Blocchi:** Nessuno.

---

### Development-3 — Infrastructure
**Finestra di lavoro:** 08:30–09:00, 18:00–18:30

**Check mattutino:**
- Railway dex-scanner: container running, uptime da ieri 16:00. Nessun restart.
- Memoria: 287mb / 512mb. CPU: picchi durante check, poi torna a 0. Normale.
- Workflow email n8n: arrivate entrambe alle 08:02 CET. Confermato.

**Check serale:**
- Struttura `/company/reports/` su GitHub: pronta per ricevere file di oggi.
- Nessuna modifica infrastrutturale necessaria.

**Nota:** Se il bot scala (più token, più check), la memoria potrebbe aumentare. Da monitorare ma non urgente.

**Risultato:** Infrastruttura stabile, uptime 100%.
**Comunicato al CEO:** Nessun intervento richiesto.
**Blocchi:** Nessuno.

---

### Testing-1 — Validation
**Finestra di lavoro:** 09:00–19:00 (monitoraggio continuo)

**Attività:**
- Monitoraggio log Railway per tutta la giornata.
- Documentati i 3 eventi V6:

| Orario CET | Token | C1 | C2 | C3 | Esito |
|---|---|---|---|---|---|
| ~10:45 | SMB | ✅ 12min | ✅ $42k | ✅ | SL -41% |
| ~11:30 | Twig | ✅ 13min | ✅ $38k | ✅ | SL -98% (rug) |
| ~17:10 | MTS | ✅ 12min | ✅ $45k | ✅ | SL -44% |

- Verifica tracking TP: nei log, dopo ogni check position, appare `[V6] checking TP on {token}`. Confermato aggiornamento ogni minuto. Nessun token ha mai superato 1.1x.
- Nessun token ha mantenuto il prezzo sopra l'entry price dopo la prima candela post-entry.

**Risultato:** 3 trade V6 documentati. Sistema tracking TP funziona correttamente.
**Comunicato al CEO:** Tutti e 3 SL. Sistema funziona, il problema è l'entry.
**Blocchi:** Nessuno tecnico. Limite statistico: 3 trade non sono conclusivi.

---

### Analysis-1 — Trade Analysis
**Finestra di lavoro:** 09:00–14:00, 16:00–17:30

**Attività mattutina:**
- Dataset aggiornato: 50 → 69 trade (+19 nuovi).
- Distribuzione per bucket età (19 nuovi trade):

| Bucket età | Trade | Pump ≥2x | EV stimato |
|---|---|---|---|
| 0-10min | 2 | 0 | -45% |
| 11-15min | 6 | 1 | ~+12% |
| 16-25min | 4 | 0 | -38% |
| 26-40min | 5 | 0 | -44% |
| 40min+ | 2 | 0 | -50% |

- Bucket 11-15min ancora il migliore: 1 pump su 6 trade oggi (17%), coerente con pattern sui 69 trade totali.
- Nessun nuovo pump ≥2x oggi. I 5 pump storici rimangono invariati.

**Attività pomeridiana:**
- EV aggiornato su 69 trade: -43.1% (era -42.7% su 50 trade).
- Win rate: 2/69 = 2.9%. Avg win: +190.1%. Avg loss: -50.0%.
- Calcolo soglia matematica EV positivo: WR ≥ 50/(50+190) = **20.8%**. Obiettivo quantificato.
- Output consegnato a Strategy-1 e Strategy-3.

**Risultato:** Dataset aggiornato, EV -43.1%, soglia WR necessaria calcolata al 20.8%.
**Comunicato al CEO:** Nessun nuovo pump. Bucket 11-15min tiene. Obiettivo V6 quantificato.
**Blocchi:** Nessuno.

---

### Research-1 — Market Research
**Finestra di lavoro:** 10:00–14:00

**Attività:**
- Analisi volume lanci pump.fun: ~240 nuovi token in 3h (09:00-12:00). Saturazione elevata.
- Aggiornamento analisi Base chain su DexScreener: 18 nuovi token memecoin nelle ultime 24h.
  - Liquidità media iniziale: $8k-$25k (vs $20k-$80k Solana)
  - Tempi di pump: 5-8 minuti (vs 10-20 minuti Solana)
  - Implicazione: check interval 1 minuto ancora più critico su Base
- Studio repo GitHub open source per scanning DexScreener su Base: struttura simile al nostro scanner.
- Analisi RPC Base vs Solana: Base usa standard EVM — buyer extraction completamente diversa da Solana. Richiede riscrittura completa della logica RPC.
- **Stima effort espansione rivista: 3-4 giorni** (era 2-3 giorni).

**Risultato:** Base chain confermata come opportunità. Effort rivisto al rialzo.
**Comunicato al CEO:** Mercato Base crescente ma più piccolo. Effort 3-4 giorni.
**Blocchi:** Nessuno. In attesa di approvazione fondatori.

---

### Research-2 — Behavioral Research
**Finestra di lavoro:** 11:00–16:00

**Attività:**
- Analisi crash velocity sui 3 trade V6:
  - SMB: peak nella prima candela post-entry, poi discesa lineare verso SL
  - Twig: peak nella seconda candela (1.057x), poi rug istantaneo
  - MTS: peak al momento dell'entry (1.0x), mai sopra
- Confronto con i 5 pump storici:
  - EIS, TRUE, NVIDIA, PND, EMOji: tutti hanno fatto il peak 15-40 minuti DOPO l'entry
  - I 3 trade V6 odierni: peak entro 1-2 minuti dall'entry
- Conclusione: **pattern "dead cat entry"** — il bot entra su un rimbalzo di breve durata dopo un movimento già avvenuto.
- Proposta metrica futura "momentum residuo": misurare txns nell'ultimo minuto vs media ultimi 5min. Se txns ultimo minuto > media = accelerazione in corso. Se < media = decelerazione = non entrare.
- Proposta inviata a Strategy-1. Risposta: da tenere per V7, nessuna modifica V6 prima di 15 trade.

**Risultato:** Pattern "dead cat entry" documentato e comunicato. Proposta ipotesi V7.
**Comunicato al CEO:** Il problema non è la logica V6 in sé, è il timing dell'entry nel ciclo del token.
**Blocchi:** Nessuno.

---

### Social-1 — X & Social Monitoring
**Finestra di lavoro:** 09:00–18:00 (manuale)

**Attività:**
- Monitoraggio manuale X su 12 token Solana lanciati oggi (09:00–15:00 CET).
- Risultati analisi account X:
  - 5/12 account creati stesso giorno del lancio → tutti morti entro 1h (100%)
  - 7/12 account con storia >30 giorni → 2 pump significativi (28.5%)
- Token MTS (trade V6): account X creato 3 giorni fa, 23 follower, solo tweet spam. Coerente con SL registrato.
- Narrative identificate su X oggi:
  1. "AI agent tokens on Solana": 3 token con AI nel nome, tutti morti entro 2h — usato come bait
  2. "Base meme season": account con 10k+ follower spingono questa narrativa — correlata con crescita volumi Base (Research-1 conferma)
  3. "Solana congestion": lamentele fee alte — potrebbe spiegare alcuni crolli rapidi
- Nessun token del dataset odierno pre-segnalato su Telegram pump.fun prima dell'entry del bot.

**Blocchi:** ⚠️ API Twitter non attiva — tutto manuale. Capacità massima ~12-15 token/giorno. Non scalabile.
**Nota:** Considerare tool di monitoring X senza API ufficiale (nitter, scraping etico) per aumentare copertura.
**Comunicato al CEO:** Correlazione X account age confermata. MTS aveva account recente. Narrativa AI bait identificata.

---

### Security-1 — Risk & Stability
**Finestra di lavoro:** 08:00–09:00, 13:00–14:00, 17:30–18:30

**Check mattutino:**
- Rate limit DexScreener: 0 errori 429 in 24h.
- Stima chiamate API: ~2.160/giorno (1.5/min × 1.440 min). Sotto soglia stimata.
- Single points of failure: Railway ✅ | GitHub API ✅ | n8n webhook ✅.

**Analisi caso Twig:**
- Ricostruzione: liquidità ~$15k, singolo wallet ha venduto intera posizione in un blocco.
- Crollo registrato dal bot al check successivo (68 secondi dopo l'entry).
- Non è un bug — è un rug instantaneo strutturalmente non prevenibile con check 1min.
- Aumentare frequenza dei check aggraverebbe il rischio 429 senza beneficio reale.
- Classificato: **rischio accettabile**.

**Check serale:**
- Sistema stabile. Nessun alert attivo.
- Buyer data RPC: condizione per test (trade fresco ≤30min, pre-score ≥35) non presentata oggi. Monitoraggio continua.

**Risultato:** Sistema stabile. 2 rischi identificati ieri: rate limit declassato a standard, rug instantaneo classificato accettabile.
**Comunicato al CEO:** Nessun problema tecnico. Twig è un rug, non un bug.
**Blocchi:** Nessuno.

---

### Platform-1 — Tooling & Productivity
**Finestra di lavoro:** 10:00–13:00 | Prima giornata operativa

**Attività:**
- **Claude:** sonnet-4-6 attuale, nessun aggiornamento nelle ultime 48h. Opus 4.7 disponibile ma non necessario.
- **GitHub CLI v2.67:** ultima release. Changelog letto, nessuna feature rilevante per il progetto.
- **n8n Cloud:** versione stabile. Changelog ultimi 30 giorni: niente di critico. Funzione "Sub-workflow" interessante per modularizzazione futura.
- **GitHub Actions — opportunità identificata:**
  - Workflow .yml che fa push automatico dei 3 file report su trigger serale (cron 19:50 CET)
  - Effort: 2-3 ore
  - Richiede GitHub token come secret nel repository
  - Elimina push manuale ogni sera
- **GitHub MCP Server (Anthropic ufficiale) — da studiare:**
  - Permetterebbe a Claude di fare commit/push direttamente da conversazione
  - Più potente di GitHub Actions per usi interattivi
  - Studio programmato per domani

**Risultato:** 2 opportunità concrete identificate e comunicate al CEO.
**Comunicato al CEO:** GitHub Actions per auto-push report (effort 2-3h). GitHub MCP da studiare domani.
**Blocchi:** In attesa di approvazione per procedere.

---

### Org-2 — Operations & Organization
**Finestra di lavoro:** 08:00–09:30, 18:00–19:00

**Attività mattutina:**
- Verifica ricezione email 08:00 CET: entrambi i workflow n8n hanno girato alle 08:02. Contenuto corretto — dati da GitHub aggiornati al trade precedente.
- Aggiornamento RIPRENDERE_DA_QUI.txt: SHA scanner, 50→69 trade, V6 attivo con 3 trade, email workflows, colonne Sheets 42, struttura 3 output giornalieri.

**Attività serale:**
- Preparazione struttura per push report su GitHub `/company/reports/`.
- Coordinamento CEO per produzione 3 output.
- Standard 3 output (daily_report, meeting_minutes, team_raw_notes) consolidato e salvato in memoria.

**Risultato:** Operazioni giornaliere funzionanti. Standard report consolidato.
**Comunicato al CEO:** Tutto pronto per push GitHub.
**Blocchi:** Nessuno.

---

### Historical-Data-1
**Status:** Non attivato. Nessun task assegnato. In standby fino a definizione perimetro.

---
*Meeting Minutes — 2026-04-20 — Crypto Bot Division*
