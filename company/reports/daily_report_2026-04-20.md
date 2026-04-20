# Daily Report — 2026-04-20
## CEO → Fondatori | Ore 20:00 CET

---

## 1. STATO GENERALE

Sistema operativo. Bot attivo senza interruzioni per tutta la giornata. Oggi è stata la prima giornata completa di tracking V6 su dati reali: 3 segnali catturati, nessuno ha raggiunto il target. È un dato negativo ma statisticamente prematuro — servono almeno 15 trade per trarre conclusioni.

**KPI principali:**
- Trade totali nel database: 69 chiusi | 0 aperti
- Nuovi trade oggi: 19
- V6 segnali rilevati: 3 (SMB, Twig, MTS)
- V6 TP@2x raggiunti: 0 | V6 TP@1.5x raggiunti: 0
- Win Rate complessivo (baseline V1): 2/69 = 2.9%
- Sistema Railway: online, nessun crash

**Avanzamento verso il goal:**
Siamo al 20% del target di validazione V6 (3/15 trade). I 3 trade sono tutti in stop loss — dato da monitorare nelle prossime 48h ma non sufficiente per alcuna conclusione strategica.

---

## 2. REPORT TEAM PER TEAM

| Team | Attività principale | Stato | Blocchi |
|---|---|---|---|
| Strategy-1 | Analisi 3 trade V6, revisione criteri entry | ✅ Operativo | Nessuno |
| Strategy-2 | Post-mortem exit sui 3 trade V6 SL | ✅ Operativo | Nessuno |
| Strategy-3 | Review direzione V6, piano transizione bozza | ✅ Operativo | Nessuno |
| Development-1 | Monitoraggio bot live, log analysis | ✅ Operativo | Nessuno |
| Development-2 | Pipeline dati verificata, Sheets aggiornato | ✅ Operativo | Nessuno |
| Development-3 | Railway stabile tutto il giorno | ✅ Operativo | Nessuno |
| Testing-1 | Registrazione e tracciamento 3 trade V6 | ✅ Operativo | Nessuno |
| Analysis-1 | Analisi 19 nuovi trade, update dataset 69 trade | ✅ Operativo | Nessuno |
| Research-1 | Studio Base chain aggiornato, stima effort rivista | ✅ Operativo | Nessuno |
| Research-2 | Pattern "dead cat entry" identificato sui trade V6 | ✅ Operativo | Nessuno |
| Social-1 | Monitoraggio X manuale, 12 token analizzati | ✅ Operativo | ⚠️ API Twitter non attiva |
| Security-1 | Rate limit DexScreener ok, analisi caso Twig | ✅ Operativo | Nessuno |
| Platform-1 | Prima giornata operativa, 2 opportunità identificate | ✅ Operativo | Nessuno |
| Org-2 | Email verificate, RIPRENDERE_DA_QUI aggiornato | ✅ Operativo | Nessuno |
| Historical-Data-1 | Non attivato — nessun task assegnato | — | — |

**Strategy-1:** Ha analizzato i 3 trade V6. SMB (age 12min, mcap $42k, priceChange5m +7.2%) — entrato nei criteri, peak 1.0x, SL a -41%. Ipotesi formulata: il criterio C3 misura il movimento degli ultimi 5 minuti, che potrebbe essere già consumato al momento della scansione. Decisione: nessuna modifica a V6 prima di 15 trade.

**Strategy-2:** Post-mortem exit: nessuno dei 3 trade ha mai superato 1.1x. Il meccanismo TP@2x non ha avuto modo di attivarsi. Caso Twig documentato come rug instantaneo (0.02x): non è un bug del sistema di exit. Conclusione: il problema è l'entry, non l'exit.

**Strategy-3:** Confermata la direzione V6. Stesura bozza piano transizione V1→V6: se pump rate >30% su 15 trade, V6 diventa strategia principale. V1 rimane comparativo per altri 30 trade, poi disattivato.

**Development-1:** 847 check interval completati nelle prime 18h senza errori. Nessun errore 429. I 3 trade V6 correttamente loggati con flag `[V6] ✅ ENTER`. Caso Twig ricostruito dai log: crollo da 1.0x a 0.021x in 68 secondi — rug confermato.

**Development-2:** Pipeline n8n → Sheets funzionante. Campionamento 5 trade: tutti i campi V6 compilati correttamente. SMB/Twig/MTS verificati individualmente su Google Sheets.

**Development-3:** Railway uptime 100%. Memoria bot: 287mb/512mb. Struttura `/company/reports/` su GitHub pronta e operativa.

**Testing-1:** 3 eventi V6 documentati con orari, criteri, esito. Confermato che il flag tp2x_hit/tp1_5x_hit viene aggiornato ogni minuto ma nessun token ha mai superato l'entry price dopo la chiusura della prima candela.

**Analysis-1:** Dataset 69 trade aggiornato. EV: -43.1% (peggio di 0.4% rispetto a ieri). Bucket 11-15min ancora il migliore anche oggi (1 pump su 6 trade = 17%). Calcolo soglia matematica: per EV positivo con avg win +190% e avg loss -50% serve WR ≥20.8%. Attualmente 2.9% — obiettivo V6 è portarlo sopra soglia.

**Research-1:** Studio Base chain aggiornato: 18 nuovi token memecoin oggi su DexScreener Base. Tempi di pump più brevi (5-8 min vs 10-20 min Solana). Stima effort espansione rivista a 3-4 giorni (vs 2-3 di ieri) per differenza RPC EVM vs Solana — buyer extraction da riscrivere completamente.

**Research-2:** Identificato pattern "dead cat entry": i 3 trade V6 odierni hanno tutti raggiunto il peak nella prima/seconda candela post-entry, poi discesa lineare. Contrario ai 5 pump storici che hanno fatto il peak 15-40 minuti dopo l'entry. Proposta ipotesi futura: misurare accelerazione txns (ultimo minuto vs media 5min) invece di priceChange5m.

**Social-1:** 12 token analizzati manualmente su X. 5/12 con account creato stesso giorno del lancio: tutti morti entro 1h. Token MTS (trade V6): account X creato 3 giorni fa, 23 follower, solo spam. Narrativa "AI tokens" usata come bait oggi (3 token AI-branded, tutti morti). Narrativa "Base meme season" correlata con crescita volumi Base confermata da Research-1.

**Security-1:** Rate limit DexScreener: 0 errori 429 in 24h. Stima ~2.160 chiamate/giorno — sotto soglia. Caso Twig classificato come rischio accettabile (rug instantaneo non prevenibile con check 1min). Buyer data RPC: condizione per test non presentata oggi.

**Platform-1:** Prima giornata. Nessun aggiornamento critico su Claude/GitHub CLI/n8n. Identificate 2 opportunità: (1) GitHub Actions per auto-push report giornalieri, effort 2-3h; (2) GitHub MCP server ufficiale Anthropic per integrazione diretta Claude→GitHub, da studiare domani.

**Org-2:** Email 08:00 CET verificate: arrivate entrambe correttamente. RIPRENDERE_DA_QUI.txt aggiornato. Standard 3 output giornalieri consolidato.

---

## 3. SCOPERTE IMPORTANTI

**Research-2 + Strategy-1 — Pattern "dead cat entry":** I 3 trade V6 mostrano tutti peak nella prima candela post-entry. Il criterio C3 (priceChange5m >5%) misura movimento passato, non futuro. Ipotesi: il bot entra su token che hanno già esaurito il momentum. Dato comunicato a entrambi i team. Non si modificano i criteri prima di 15 trade.

**Analysis-1 — Soglia matematica EV:** Per raggiungere EV positivo con le attuali medie di win/loss, serve WR ≥20.8%. V6 deve portare il win rate da 2.9% a oltre 20% per essere profittevole. Obiettivo chiaro e quantificato.

**Security-1 — Rate limit DexScreener ok:** Dopo 24h con check interval 1min, nessun errore 429. Rischio declassato da urgente a monitoraggio standard.

**Research-1 — Effort Base chain rivisto:** 3-4 giorni (non 2-3) per la differenza RPC. Dato aggiornato per eventuale pianificazione futura.

---

## 4. PROBLEMI PRINCIPALI

⚠️ **V6 — 0 TP raggiunti su 3 trade:** Tutti e 3 in stop loss, nessun movimento positivo dopo entry. Non ancora un segnale statistico ma da tenere monitorato. Se i prossimi 5-7 trade mostrano lo stesso pattern, Strategy-1 deve rivedere C3.

⚠️ **Buyer data RPC:** Fix deployato il 2026-04-19, ancora non validato su caso reale. Condizione non presentata oggi.

⚠️ **Twig — rug instantaneo:** Perdita -97.9% in 68 secondi tra due check. Non è un bug — è un limite strutturale del check interval. Classificato come rischio accettabile.

---

## 5. OPPORTUNITÀ NUOVE

**Platform-1:** GitHub Actions per auto-push report giornalieri. Effort 2-3 ore, elimina push manuale ogni sera. In attesa di approvazione per procedere domani.

**Research-1:** Base chain — stima aggiornata a 3-4 giorni. Mercato più piccolo ma meno competitivo e con pattern simili a Solana.

---

## 6. DECISIONI RICHIESTE AI FONDATORI

**Una domanda aperta (dalla sessione del 2026-04-19):** Autorizzare Research-1 a esplorare Base chain in parallelo, oppure focus esclusivo su Solana fino alla validazione V6?

**Nuova proposta Platform-1:** Autorizzare setup GitHub Actions per auto-push report giornalieri (effort 2-3 ore)?
