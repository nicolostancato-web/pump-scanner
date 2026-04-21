# SECURITY-1 — Audit Credenziali
**Data:** 2026-04-21 | **Tipo:** Primo audit reale
**Eseguito da:** CEO / Security-1

---

## CREDENZIALI IDENTIFICATE E STATO

| Credenziale | Dove è salvata | Esposizione | Rischio | Azione |
|---|---|---|---|---|
| Anthropic API Key (sk-ant-...) | Claude Code memory locale + n8n credential | Locale + n8n cloud | Medio | Key attiva in n8n come httpHeaderAuth — OK |
| GitHub Personal Access Token | Claude Code memory locale | Solo locale | Basso | Scope limitato a pump-scanner — monitorare |
| Railway API Token | Claude Code memory locale | Solo locale | Basso | Non esposto pubblicamente |
| n8n API Key (JWT) | Claude Code memory locale | Solo locale | Medio | Scade ~3 giugno 2026 — pianificare rinnovo |
| Gmail OAuth2 | n8n credential system | n8n cloud | Basso | OAuth2 — revocabile, sicuro |
| Google Sheets/Docs/Drive OAuth2 | n8n credential system | n8n cloud | Basso | OAuth2 — OK |
| OpenAI API Key | n8n credential system | n8n cloud | Medio | Monitorare usage |
| Telegram Bot Token | n8n credential system | n8n cloud | Basso | OK |
| WhatsApp tokens (x3) | n8n credential system | n8n cloud | Basso | OK |

---

## RISCHI APERTI

1. **API key in file di memoria locale** — Le credenziali sono in ~/.claude/projects/.../memory/project_all_keys.md. File locale, non pubblico. Rischio basso ma non ideale. Raccomandazione: mantenere per operatività, non committare mai su repo pubblici.

2. **n8n JWT scade 3 giugno 2026** — Pianificare rinnovo prima della scadenza.

3. **GitHub token scope limitato** — Token non può creare nuovi repo, solo pump-scanner. OK per ora.

4. **Wallet Solana** (E51F1pku95NG7oXbAHGmquP4sy31hucfok7EiwbanuxV) — Indirizzo pubblico, normale. La chiave privata NON è in nessun file del sistema. Verificare che rimanga così.

---

## COSE CHE NON ESISTONO (no rischio)

- Nessuna chiave privata wallet salvata nel sistema
- Nessuna credenziale committata su repo pubblici
- Nessun file .env esposto

---

## RACCOMANDAZIONI IMMEDIATE

- [ ] Pianificare rinnovo n8n JWT entro maggio 2026
- [ ] Non espandere il GitHub token scope senza necessità
- [ ] Mai salvare chiave privata wallet in nessun file del sistema
- [ ] Monitorare usage OpenAI per anomalie

**Stato sicurezza complessivo:** ACCETTABILE — nessun rischio critico immediato.
