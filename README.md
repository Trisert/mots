# Mots

Mots è un compagno AI mobile-first: ricorda le cose importanti, organizza promemoria, cerca nelle conversazioni passate e resta nella tua tasca. L'obiettivo è un'architettura platform-agnostic con un'app mobile come primo client, costruita sopra [Pi Durable](https://github.com/earendil-works/pi/tree/main/packages/durable) e Cloudflare Durable Objects.

> **Stato: MVP in sviluppo attivo.** Monorepo funzionante. Typecheck di tutti i workspace, test di protocollo/client, dry-run del Worker e bundle Android verificati. Autenticazione, copertura E2E con LLM reale e deploy pubblico sono i prossimi passi.

## Cosa c'è già

- **App mobile Expo** con onboarding, creazione/ingresso in una sessione, chat in streaming, lista conversazioni, condivisione del codice, fork da un messaggio e stato di connessione.
- **Server Cloudflare Worker** con una sessione per Durable Object, storage SQLite, WebSocket hibernabili e alarm.
- **Agente Mots** basato sull'harness di Pi Durable, con provider OpenRouter.
- **Memoria durevole** per sessione: preferenze e fatti sopravvivono alle conversazioni.
- **Promemoria** programmati con tool `schedule`, ricorrenze e risveglio via alarm.
- **Ricerca nella storia** delle conversazioni tramite subagent.
- **Client SDK condiviso** con riconnessione automatica, coda comandi affidabile e stato React compatibile con `useSyncExternalStore`.

## Architettura

```
┌──────────────────────────────┐
│ App Expo (@mots/mobile)      │
│ onboarding · chat · sessioni │
└──────────────┬───────────────┘
               │ WebSocket /api/sessions/:id
┌──────────────▼───────────────┐
│ Worker (@mots/server)        │
│ CORS · health · nuove sessioni│
└──────────────┬───────────────┘
               │ Durable Object binding SESSIONS
┌──────────────▼───────────────┐
│ Session (1 per sessione)     │
│ SQLite · WebSocket · alarm   │
│ Pi Durable Harness           │
│  └─ @mots/agent              │
│      ├─ OpenRouter           │
│      ├─ memoria              │
│      ├─ promemoria           │
│      └─ ricerca storia       │
└──────────────────────────────┘
        @mots/protocol · @mots/client
```

- Una **sessione** è identificata da un UUID e vive in un singolo Durable Object.
- Il Worker crea l'ID ma non conserva stato: la sessione esiste quando il DO viene contattato.
- Il client apre un WebSocket e riceve snapshot, eventi dell'agente, presenza e conferme dei comandi.
- I comandi di creazione/fork sono ritentabili tramite outbox; i prompt hanno una ricevuta con `submissionId`.
- I promemoria usano gli alarm del Durable Object; la memoria usa un documento Pi con scope sessione.

## Struttura del repository

```
apps/
  mobile/    App Expo + React Native
  server/    Cloudflare Worker + Durable Object
packages/
  protocol/  Tipi e validazione del protocollo wire
  client/    MotsClient, reducer di stato, outbox
  agent/     Harness Pi, OpenRouter, tool e sezioni
```

## Requisiti

- [Bun](https://bun.sh/) 1.4 o successivo per install, typecheck, test ed Expo.
- [Node.js](https://nodejs.org/) 22 o successivo nel `PATH` per eseguire Wrangler. Wrangler non funziona correttamente se viene avviato dal runtime di Bun: in quel caso `wrangler dev` risponde `503`.
- Una chiave API [OpenRouter](https://openrouter.ai/keys).
- Per il telefono: Expo Go oppure un emulatore Android / simulatore iOS.
- Un account Cloudflare solo per il deploy del Worker.

Il repository usa Bun come package manager e non richiede npm. Gli build nativi (EAS / Xcode / Android Studio) possono richiedere i rispettivi toolchain.

## Avvio rapido

```powershell
bun install
Copy-Item apps/server/.dev.vars.example apps/server/.dev.vars
```

Apri `apps/server/.dev.vars` e inserisci la chiave:

```dotenv
OPENROUTER_API_KEY=sk-or-...
# MOTS_MODEL=openai/gpt-6-luna
```

Avvia server e app in due terminali:

```powershell
bun run dev:server
bun run dev:mobile
```

- Server locale: `http://localhost:8787` (`GET /api/health`).
- Se il server risponde `503`, controlla che `node --version` funzioni e che Node preceda Bun nel `PATH`: `wrangler dev` deve girare su Node.
- Nell'app premi **Crea il tuo spazio**.
- Android emulator: usa `http://10.0.2.2:8787` (già impostato come default).
- iOS simulator: `http://localhost:8787`.
- Telefono fisico sulla stessa rete: avvia `bun run dev:server:lan` (binding `0.0.0.0`), inserisci nell'app l'indirizzo LAN del computer, ad esempio `http://192.168.1.10:8787`, e consenti Node/Expo nel firewall Windows.
- Se la rete isola i dispositivi (tipico di reti pubbliche come eduroam) o il firewall blocca le porte, usa un tunnel HTTPS/WSS oppure un emulatore Android.

Per provare l'interfaccia nel browser senza telefono:

```powershell
bun run dev:web
```

L'anteprima usa `http://localhost:8787` come server; l'URL resta modificabile dall'onboarding. Su una macchina remota (ad esempio Replit) imposta `EXPO_PUBLIC_MOTS_API_URL` con l'URL raggiungibile del server prima di avviare l'anteprima web.

### Deploy su Cloudflare

```powershell
cd apps/server
bunx wrangler secret put OPENROUTER_API_KEY
bunx wrangler deploy
```

Poi nell'app usa l'URL pubblico del Worker come server.

## Configurazione

| Variabile | Dove | Descrizione |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | server (`apps/server/.dev.vars` o secret Cloudflare) | Obbligatoria per chiamare il modello. Non viene mai inviata al client. |
| `MOTS_MODEL` | server | Modello OpenRouter. Default: `openai/gpt-6-luna`. |
| `EXPO_PUBLIC_MOTS_API_URL` | build mobile | URL server precompilato nell'app. Modificabile anche dall'onboarding. |

`.dev.vars` è ignorato da git. Non committare mai chiavi API.

## Comandi

| Comando | Cosa fa |
| --- | --- |
| `bun install` | Installa tutti i workspace. |
| `bun run dev:server` | Avvia Wrangler in locale sulla porta 8787. |
| `bun run dev:server:lan` | Avvia Wrangler su `0.0.0.0:8787` per il telefono. |
| `bun run dev:mobile` | Avvia Expo. |
| `bun run dev:web` | Avvia l'anteprima web di Expo. |
| `bun run typecheck` | Typecheck di tutti i package. |
| `bun run test` | Test di protocollo e client. |
| `bun run check` | Typecheck + dry-run del Worker. |
| `bun run check:server` | Solo `wrangler deploy --dry-run`. |
| `bun run build:mobile` | Export Android con Metro. |
| `bun run --cwd apps/server deploy` | Deploy del Worker. |

## API

| Metodo | Percorso | Descrizione |
| --- | --- | --- |
| `GET` | `/api/health` | Health check. |
| `POST` | `/api/sessions` | Crea un UUID di sessione. Risponde `201` con `{ sessionId, url, socketPath }`. |
| `GET` | `/api/sessions/:id` | Upgrade WebSocket verso il Durable Object della sessione. |

Il protocollo applicativo vive in `packages/protocol`: comandi client (`conversation.open`, `conversation.create`, `conversation.fork`, `prompt.submit`, `presence.typing`) ed eventi server (snapshot, eventi conversazione, inbox, presenza, risultati comandi, errori).

## Tool dell'agente

| Tool | Funzione |
| --- | --- |
| `remember` | Salva un fatto o una preferenza durevole (max 100, deduplicati). |
| `forget` | Rimuove le memorie che corrispondono a una frase. |
| `schedule` | Programma un'istruzione nel futuro, con ricorrenza e timezone. |
| `search_history` | Cerca nelle conversazioni passate tramite subagent. |

La persona dell'agente, l'orologio e la memoria vengono iniettati come sezioni del contesto. I messaggi utente possono includere `[Nome]` come attribuzione del parlante.

## Stato e prossimi passi

- [x] Monorepo Bun + TypeScript con workspace.
- [x] Protocollo, client SDK e reducer condivisi.
- [x] Worker + Durable Object con SQLite, WebSocket e alarm.
- [x] Agente OpenRouter con memoria, promemoria e ricerca.
- [x] App mobile con onboarding, chat, sessioni e fork.
- [x] Typecheck, dry-run Worker, bundle Android.
- [x] Test automatici di protocollo e client (19 test).
- [x] Verifica end-to-end locale: health, creazione sessione, WebSocket e nuova conversazione.
- [ ] Autenticazione, rate limiting e policy CORS.
- [ ] Notifiche push per i promemoria.
- [ ] Markdown, immagini e messaggi vocali.
- [ ] Build iOS e deploy demo.

Per seguire l'avanzamento: questa sezione, `git log --oneline` e i comandi di verifica qui sopra.

## Sicurezza e limiti dell'MVP

- Non c'è autenticazione: chi conosce l'UUID della sessione può accedervi. L'UUID va trattato come una capability segreta.
- CORS è aperto a tutte le origini.
- Non ci sono rate limit né quote per utente.
- La chiave OpenRouter resta lato server.
- I dati non sono cifrati end-to-end: sono nello storage del Durable Object.
- Mots non è pronto per la produzione finché questi punti non sono risolti.

## Licenza

MIT. Vedi [LICENSE](LICENSE).

Costruito studiando [pi-durable-cloudflare](https://github.com/earendil-works/pi-durable-cloudflare) e i package [Pi](https://github.com/earendil-works/pi).
