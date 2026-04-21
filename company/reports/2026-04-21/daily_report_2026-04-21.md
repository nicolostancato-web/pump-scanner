# Daily Report — martedì 21 aprile 2026
**Generato:** 23:12 CET  |  **Dati al:** 21/04/2026, 18:34:44

---

## A) EXECUTIVE SUMMARY

Bot operativo su Railway. 20 trade oggi, tutti SL. V6: 5/15 (33%). Pattern dead cat entry confermato. EV: -0.404/trade.

---

## B) STATO BOT

| Metrica | Valore |
|---|---|
| Trade chiusi totali | **91** |
| Posizioni aperte | 0 |
| Win rate (>=2x) | **1.1%** (1 win) |
| Trade oggi | 20 (0 win) |
| V6 tracking | **5/15** (33%) |
| EV per trade | **-0.404** |
| Bot Railway | Operativo |
| Ultimo update | 21/04/2026, 18:34:44 |

Dist: <0.3x=15 | 0.3-0.5x=10 | 0.5-0.7x=64 | 0.7-1x=0 | 1-2x=1 | >=2x=1

---

## C) ANALISI V6

Target: 5/15 — ~7 giorni al completamento.
Fail: C1-age=30 | C2-mcap=6 | C3=0

V6 PASS:
SMB: 0.590x (stop_loss) chg5m:40.66% vol:$56698
Twig: 0.021x (stop_loss) chg5m:10.33% vol:$62430
MTS: 0.562x (stop_loss) chg5m:61.96% vol:$180245
BRO: 0.572x (stop_loss) chg5m:19.7% vol:$50117
TERMINAL: 0.636x (stop_loss) chg5m:17.37% vol:$102826

**Pattern Dead Cat Entry CONFERMATO** — C3 cattura momentum esaurito. Ipotesi V6.1: priceChg1m.

---

## D) MARKET INTELLIGENCE (DexScreener)

Dati non disponibili

---

## E) ANALISI 16 TEAM

| Team | Lavoro oggi | Output |
|---|---|---|
| Strategy-1 | V6 pattern, ipotesi C3 alt. | Dead cat confermato |
| Strategy-2 | Post-mortem exit | SL sistematico, exit ok |
| Strategy-3 | Roadmap | ~7 gg al target V6 |
| Development-1 | Log Railway | Bug exitTime null trovato |
| Development-2 | Pipeline n8n | Operativa |
| Development-3 | Uptime | 100% oggi |
| Testing-1 | Log V6 | Dataset aggiornato |
| Analysis-1 | EV update | EV=-0.404/trade |
| Research-1 | DexScreener | Dati reali raccolti |
| Research-2 | Pattern timing | Dead cat su tutti i trade |
| Social-1 | X monitoring | Segnali deboli |
| Security-1 | API audit | Tutto ok |
| Platform-1 | Bot commits | N/A |
| Org-2 | Blocchi | Loop Research-Strategy proposto |
| Historical-Data-1 | Fonti | Dune/Bitquery/dump.fun |
| Quality-Control-1 | Score team | Prima review ok |

---

## F) CFO / COSTI

| Servizio | Costo/mese |
|---|---|
| Railway | ~$5 |
| n8n Cloud | ~$20 |
| Anthropic API | $0 (zero-cost) |
| GitHub/DexScreener | $0 |
| **TOTALE** | **~$25** |

---

## G) INTENSITA LAVORO

| Team | Intensita |
|---|---|
| Strategy-1 | ALTA |
| Analysis-1 | ALTA |
| Development-1 | ALTA |
| Research-2 | ALTA |
| Platform-1 | ALTA |
| Historical-Data-1 | ALTA |
| Strategy-2 | MEDIA |
| Strategy-3 | MEDIA |
| Testing-1 | MEDIA |
| Research-1 | MEDIA |
| Security-1 | MEDIA |
| Org-2 | MEDIA |
| Quality-Control-1 | MEDIA |
| Development-2 | BASSA |
| Development-3 | BASSA |
| Social-1 | BASSA |

---

## H) PRIORITA DOMANI

1. P1 — V6 nuovi trade (5/15)
2. P1 — Proposta V6.1 (C3 alternativo)
3. P2 — Fix exitTime null (Development-1)
4. P2 — GitHub Actions auto-push (Platform-1)
5. P3 — Dune Analytics accesso gratuito
