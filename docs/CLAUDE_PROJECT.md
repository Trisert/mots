# Lavorare su Mots da un Claude Project

Questa pagina serve a riprendere il lavoro su Mots da un Claude Project su claude.ai, senza perdere il contesto delle sessioni precedenti. Lo stato vive nel repository, non nella chat: chi riprende legge i file qui sotto.

## Conoscenza del progetto

Aggiungi questi file alla conoscenza del progetto (dall'integrazione GitHub del progetto, così restano sincronizzati con `main`):

| File | Perché |
| --- | --- |
| `AGENTS.md` | Regole operative: setup, comandi, convenzioni, cose da non fare. |
| `docs/ROADMAP.md` | Piano di prodotto, stato dei task M, analisi dei concorrenti, design dell'integrazione Cua Spaces. |
| `docs/ANALYSIS.md` | Audit tecnico e descrizione dettagliata di ogni task M. |
| `README.md` | Panoramica del prodotto in italiano. |
| `packages/protocol/src/index.ts` | Il protocollo wire: ogni nuova funzione passa da qui. |
| `packages/agent/src/chat.ts` | Preambolo, tool e sezioni dell'agente. |
| `apps/server/src/session.ts` | Il Durable Object `Session`. |

Dopo ogni merge su `main`, risincronizza i file del progetto.

## Istruzioni del progetto

Incolla questo testo nelle istruzioni del progetto:

```text
Lavori su Mots, un compagno AI mobile-first (Expo + Cloudflare Worker + Durable Object con Pi Durable).
Rispondi in italiano. Il codice, i commenti e i documenti in docs/ restano in inglese; i testi
dell'app restano in italiano.
Prima di proporre modifiche leggi AGENTS.md e docs/ROADMAP.md. Il prossimo lavoro si sceglie dalla
tabella "M-task status" e dalle fasi di docs/ROADMAP.md: un task per pull request.
Non inventare lo stato del codice: se un file non è nella conoscenza del progetto, dillo e chiedi
di aggiungerlo, oppure suggerisci di aprire una sessione Claude Code sul repository.
Le decisioni di prodotto prese qui vanno scritte in docs/ROADMAP.md con una PR, non lasciate solo in chat.
```

## Dal progetto al codice

Un Claude Project serve a discutere, pianificare e rivedere. Per modificare il codice apri una sessione Claude Code sul repository `Trisert/mots` (web, desktop o terminale) e incolla un prompt come questo:

```text
Leggi AGENTS.md e docs/ROADMAP.md. Implementa il task <nome del task> come descritto lì.
Un task per PR. Esegui bun run check e bun run test prima del commit. Aggiorna la tabella
"M-task status" in docs/ROADMAP.md nella stessa PR.
```

Claude Code legge `CLAUDE.md` alla radice, che importa `AGENTS.md`, quindi le regole del repository valgono anche lì.

Per lavori indipendenti si possono usare subagenti in parallelo, ognuno in un worktree separato e su file diversi, come è stato fatto il 2026-10-26 per M12, M24 e `forget`. Prima del push, chi coordina rivede ogni diff e riesegue `bun run check` e `bun run test` sull'insieme.

## Stato alla data di questa pagina

Branch `claude/funny-wozniak-jps2ms`, 2026-10-26:

- Fuso orario della sessione (`session.setTimezone`).
- `forget` sicuro e avviso quando la memoria è piena.
- M12: i comandi restano in coda mentre il socket si riconnette.
- M24: `runError` è un codice; il testo italiano è nell'app.
- `docs/ROADMAP.md`, questa pagina e `CLAUDE.md`.

`bun run test`: 217 test, 0 falliti. `bun run check`: typecheck e dry-run del Worker passano. Non è stato avviato Wrangler né l'app: il comportamento live non è verificato.

Prossimi passi consigliati, in ordine: M15 (registrazione push nell'app), poi account e tetto di spesa (Fase 1 in `docs/ROADMAP.md`).
