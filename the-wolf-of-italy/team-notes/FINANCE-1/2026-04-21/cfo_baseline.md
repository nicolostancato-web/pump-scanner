# FINANCE-1 / CFO — Baseline Economico
**Data:** 2026-04-21 | **Tipo:** Primo baseline reale
**Eseguito da:** CEO / CFO

---

## COSTI MENSILI ATTUALI (stime reali)

| Servizio | Costo Stimato/Mese | Note |
|---|---|---|
| n8n Cloud | ~$20-50 | Dipende dal piano attivo |
| Anthropic API (claude-sonnet-4-6) | ~$3-10 | 2 chiamate/giorno × 30 = 60 esecuzioni. ~8K token/chiamata. ~$0.05-0.15/chiamata |
| Railway (pump-scanner + dex-scanner) | ~$10-20 | 2 servizi attivi |
| GitHub | $0 | Free tier / repo esistente |
| CoinGecko API | $0 | Free tier, nessuna API key |
| **TOTALE STIMATO** | **~$33-80/mese** | |

---

## COSTI EVITATI OGGI

- CoinGecko free API usata per RESEARCH-CRYPTO-1 → $0 invece di $129+/mese (paid tier)
- GitHub per storage notes → $0
- Claude Code Router installato → potenziale risparmio 60-70% su task semplici se configurato

---

## CONSUMI DA MONITORARE

1. **Anthropic API** — ogni nuovo workflow che chiama Claude aggiunge costo. Monitorare token/chiamata.
2. **n8n esecuzioni** — ogni workflow aggiunto aumenta il conteggio. Verificare piano attivo.
3. **Railway** — i servizi pump-scanner e dex-scanner girano 24/7. Verificare se necessari entrambi.

---

## OPPORTUNITÀ DI RISPARMIO

| Opportunità | Risparmio Stimato | Azione |
|---|---|---|
| Claude Code Router con DeepSeek per task semplici | -60-70% costo Claude Code | Configurare ccr |
| Routing modelli n8n: usare modello più economico per report | -30-50% Anthropic API | Testare claude-haiku-4-5 per sezioni semplici |
| Consolidare Railway services se non necessari entrambi | -$5-10/mese | Verificare utilizzo reale |

---

## RICHIESTE AI FONDATORI

Nessuna al momento.

---

## PROSSIMO AGGIORNAMENTO

Baseline da aggiornare il 2026-05-01 con dati reali di consumo.
