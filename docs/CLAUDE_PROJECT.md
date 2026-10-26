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
| `apps/mobile/src/palette.ts`, `apps/mobile/src/theme.ts`, `apps/mobile/src/components/Mascot.tsx` | I token del design system e la mascotte nel codice. |
| `packages/agent/src/model-catalog.ts` | Quali modelli e provider l'app può scegliere. |

Il design system e i mockup sono Claude Artifact, non file del repository. Sono privati: per aprirli dal progetto devono essere condivisi con chi ci lavora.

- Design system Mots: https://claude.ai/artifact/HWoqJFg45sk4wqpKVKuMSW
- Mockup delle schermate: https://claude.ai/artifact/B2AKYaN547r1ghPJbMqSK9

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

Aggiornato su `main` (commit `714d63a`, PR #25 unita), 2026-10-26. La PR #24 (fuso orario, `forget`, M12, M24, accessibilità) e la PR #25 sono su `main`. Includono:

- Icone SVG al posto di `[!]`, `[+]`, `[~]` negli errori e nelle righe degli strumenti.
- `bun run setup` e `bun run dev [--web]`: secret locali generati e app che punta al Worker sulla LAN, per provare sul telefono.
- Campo di scrittura su una riga, senza il rettangolo di focus del browser.
- Selettore modelli in una schermata dedicata, caricato da `GET /api/sessions/:code/models`. Le chiavi dei provider restano sul server.
- Design system Mots nell'app: palette, Figtree, forme a pillola e la mascotte a fumetto animata.

`bun run test`: 274 test, 0 falliti. `bun run check` passa. Provato nel browser contro un Worker locale con `MOTS_FAKE_LLM=stub`, in tema chiaro e scuro. Non provato su un telefono vero.

Prossimi passi consigliati, in ordine:

1. Routine e ricordi nel protocollo e nel server, poi la barra in basso (Chat, Routine, Memoria, Profilo) dei mockup.
2. M15: registrazione push nell'app.
3. Account e tetto di spesa (Fase 1 in `docs/ROADMAP.md`).
