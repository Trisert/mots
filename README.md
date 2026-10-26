# Mots

Mots è un compagno AI mobile-first: ricorda le cose importanti, organizza promemoria, cerca nelle conversazioni passate e resta nella tua tasca. L'obiettivo è un'architettura platform-agnostic con un'app mobile come primo client, costruita sopra [Pi Durable](https://github.com/earendil-works/pi/tree/main/packages/durable) e Cloudflare Durable Objects.

> **Stato: MVP in sviluppo attivo.** Monorepo funzionante. Typecheck di tutti i workspace, suite `bun run test` (274 test), dry-run del Worker e bundle Android verificati. Il Worker rifiuta sessioni anonime. Account utente, copertura E2E con LLM reale e deploy pubblico restano i prossimi passi.

## Cosa c'è già

- **App mobile Expo** con onboarding, creazione/ingresso in una sessione, chat in streaming, lista conversazioni, condivisione del codice, fork da un messaggio e stato di connessione.
- **Server Cloudflare Worker** con una sessione per Durable Object, storage SQLite, WebSocket hibernabili e alarm.
- **Agente Mots** basato sull'harness di Pi Durable, con provider LLM configurabile. Se `MOTS_PROVIDER` manca, il codice usa Kilo. OpenRouter, Vercel AI Gateway e NVIDIA si scelgono dall'ambiente.
- **Memoria durevole** per sessione: preferenze e fatti sopravvivono alle conversazioni.
- **Promemoria** programmati con tool `schedule`, ricorrenze e risveglio via alarm.
- **Ricerca nella storia** delle conversazioni tramite subagent.
- **Client SDK condiviso** con riconnessione automatica, outbox che ritenta i comandi già spediti e non ancora confermati, e stato React compatibile con `useSyncExternalStore`.

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
│      ├─ provider LLM         │
│      ├─ memoria              │
│      ├─ promemoria           │
│      └─ ricerca storia       │
└──────────────────────────────┘
        @mots/protocol · @mots/client
```

- Una **sessione** è un codice firmato (`uuid` + HMAC). L'uuid è il nome del Durable Object; la firma è ciò che autorizza l'apertura.
- `POST /api/sessions` emette il codice e non crea il Durable Object. Il DO nasce solo quando un WebSocket presenta un codice valido.
- Il client apre un WebSocket e riceve snapshot, eventi dell'agente, presenza e conferme dei comandi.
- Creazione, fork, prompt e `conversation.setModel` restano in outbox dopo un invio riuscito. Un prompt confermato porta `submissionId`.
- I promemoria usano gli alarm del Durable Object; la memoria usa un documento Pi con scope sessione.

## Struttura del repository

```
apps/
  mobile/    App Expo + React Native
  server/    Cloudflare Worker + Durable Object
packages/
  protocol/  Tipi e validazione del protocollo wire
  client/    MotsClient, reducer di stato, outbox
  agent/     Harness Pi, provider LLM, tool e sezioni
```

## Requisiti

- [Bun](https://bun.sh/) 1.4 o successivo per install, typecheck, test ed Expo.
- [Node.js](https://nodejs.org/) 22 o successivo nel `PATH` per eseguire Wrangler. Wrangler non funziona correttamente se viene avviato dal runtime di Bun: in quel caso `wrangler dev` risponde `503`.
- Una chiave API per il provider scelto. Il predefinito è Kilo. In alternativa [OpenRouter](https://openrouter.ai/keys), Vercel AI Gateway (`AI_GATEWAY_API_KEY`, host `https://ai-gateway.vercel.sh/v1`) o NVIDIA. Vedi [Provider LLM](#provider-llm).
- Per il telefono: Expo Go oppure un emulatore Android / simulatore iOS.
- Un account Cloudflare solo per il deploy del Worker.

Il repository usa Bun come package manager e non richiede npm. Gli build nativi (EAS / Xcode / Android Studio) possono richiedere i rispettivi toolchain.

## Avvio rapido

Due comandi, dalla cartella del repository:

```powershell
bun install
bun run dev
```

`bun run dev` prepara l'ambiente e avvia tutto in un solo terminale:

1. Crea `apps/server/.dev.vars` dall'esempio, se manca, e genera `MOTS_SESSION_SECRET` e `MOTS_CREATE_TOKEN` se sono vuoti o troppo corti. I valori che funzionano già restano com'erano, quindi i codici di ingresso non si invalidano.
2. Copia lo stesso token in `apps/mobile/.env.local`, che Expo legge da solo. Non serve `set` né `$env:`.
3. Avvia il server con Node su `0.0.0.0:8787` e aspetta che `/api/health` risponda.
4. Avvia Expo con il server già impostato sull'indirizzo di rete locale del computer, e stampa gli indirizzi da aprire sul telefono.

Con Expo avviato, inquadra il QR code con Expo Go oppure premi `w` per il browser. `bun run dev --web` apre subito l'anteprima web. Dal telefono, sulla stessa Wi‑Fi, puoi anche aprire nel browser l'indirizzo `http://<IP del computer>:8081` stampato all'avvio: l'app web usa da sola il server sullo stesso host. Ctrl+C ferma sia Expo sia il server.

Se il telefono non si collega, consenti Node.js nel firewall per le reti private. Se la rete isola i dispositivi, come le reti pubbliche o eduroam, usa un emulatore oppure un tunnel HTTPS.

`bun run setup` esegue solo la preparazione, senza avviare niente. I file `.dev.vars` e `.env.local` sono ignorati da git e non vanno mai committati.

### Configurazione manuale

Se preferisci preparare l'ambiente a mano:

```powershell
Copy-Item apps/server/.dev.vars.example apps/server/.dev.vars
```

Apri `apps/server/.dev.vars`. Servono due segreti di almeno 16 caratteri. Generali con `openssl rand -base64 32` (due volte) e non riusare l'esempio vuoto del repository. Se `MOTS_PROVIDER` manca, il codice usa `kilo` e il modello `reflection/beam-free` (`DEFAULT_MODELS` in `packages/agent/src/provider.ts`):

```dotenv
MOTS_SESSION_SECRET=...
MOTS_CREATE_TOKEN=...
# KILO_API_KEY=...
# MOTS_MODEL=reflection/beam-free
```

`MOTS_SESSION_SECRET` firma i codici di ingresso: ruotarlo invalida ogni codice già condiviso. `MOTS_CREATE_TOKEN` è il bearer di `POST /api/sessions`. Senza uno dei due il Worker risponde `503` e non apre sessioni. Senza `KILO_API_KEY` il processo locale può leggere `~/.pi/agent/auth.json`, oppure inviare la chiave letterale `free`.

Per un altro provider imposta `MOTS_PROVIDER` e la chiave di quel provider. Con `openrouter` il modello predefinito è `openai/gpt-6-luna`:

```dotenv
MOTS_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
# MOTS_MODEL=openai/gpt-6-luna
```

```dotenv
MOTS_PROVIDER=vercel-ai-gateway
AI_GATEWAY_API_KEY=...
# MOTS_MODEL=reflection/beam-free
```

I dettagli dei provider sono in [Provider LLM](#provider-llm).

Scrivi lo stesso valore di `MOTS_CREATE_TOKEN` in `apps/mobile/.env.local`, altrimenti il server rifiuta la creazione dello spazio con `401`:

```dotenv
EXPO_PUBLIC_MOTS_CREATE_TOKEN=...
```

Avvia server e app in due terminali:

```powershell
bun run dev:server
bun run dev:mobile
```

- Server locale: `http://localhost:8787` (`GET /api/health`).
- Se `GET /api/health` risponde `503`, controlla che `node --version` funzioni e che Node preceda Bun nel `PATH`: `wrangler dev` deve girare su Node. Un `503` su `POST /api/sessions`, con il dev server già su Node, indica che manca `MOTS_SESSION_SECRET` o `MOTS_CREATE_TOKEN`.
- Nell'app premi **Crea uno spazio**. Il campo Server è modificabile: è lo stesso valore che l'onboarding salva con l'identità.
- Android emulator: usa `http://10.0.2.2:8787` (già impostato come default).
- iOS simulator: `http://localhost:8787`.
- Telefono fisico sulla stessa rete: avvia `bun run dev:server:lan` (binding `0.0.0.0`), inserisci nell'app l'indirizzo LAN del computer, ad esempio `http://192.168.1.10:8787`, e consenti Node/Expo nel firewall Windows.
- Se la rete isola i dispositivi (tipico di reti pubbliche come eduroam) o il firewall blocca le porte, usa un tunnel HTTPS/WSS oppure un emulatore Android.

Per provare l'interfaccia nel browser senza telefono:

```powershell
bun run dev:web
```

L'anteprima usa `http://localhost:8787` come server; l'URL resta modificabile dall'onboarding. Su una macchina remota imposta `EXPO_PUBLIC_MOTS_API_URL` con l'URL raggiungibile del server prima di avviare l'anteprima web.

### Deploy su Cloudflare

```powershell
cd apps/server
bunx wrangler secret put MOTS_SESSION_SECRET --env=""
bunx wrangler secret put MOTS_CREATE_TOKEN --env=""
bunx wrangler secret put KILO_API_KEY --env=""
bunx wrangler deploy --env=""
```

`--env=""` è il Worker di primo livello, `mots`. Senza quel flag Wrangler avvisa, perché nel file c'è anche `staging`, e il comando resterebbe sul Worker `mots`.

Il provider predefinito è `kilo`, con modello `reflection/beam-free`. Per OpenRouter, Vercel o NVIDIA metti al posto di `KILO_API_KEY` la variabile `OPENROUTER_API_KEY`, `AI_GATEWAY_API_KEY` o `NVIDIA_API_KEY`, e imposta `MOTS_PROVIDER` con `bunx wrangler secret put MOTS_PROVIDER --env=""`. Se `MOTS_PROVIDER` manca, il codice usa `kilo`. Un valore sconosciuto fa fallire l'avvio della sessione. `MOTS_MODEL` è opzionale. Non fare il deploy finché l'app mobile non invia il bearer di creazione: un client vecchio riceve `401`.

Poi nell'app usa l'URL pubblico del Worker come server. L'URL predefinito dell'app resta quello locale.

### Staging

`apps/server/wrangler.jsonc` definisce l'ambiente `staging`. Il Worker si chiama `mots-staging` ed è distinto da `mots`. La CI esegue `wrangler deploy --dry-run --env staging` (`bun run check:server:staging`) accanto al dry-run del Worker predefinito. Quel passo non pubblica nulla.

I secret dello staging si impostano con `--env staging`, dal directory `apps/server`. Non finiscono nel git.

```powershell
cd apps/server
bunx wrangler secret put MOTS_SESSION_SECRET --env staging
bunx wrangler secret put MOTS_CREATE_TOKEN --env staging
bunx wrangler secret put MOTS_CORS_ORIGINS --env staging
bunx wrangler secret put KILO_API_KEY --env staging
```

Genera `MOTS_SESSION_SECRET` e `MOTS_CREATE_TOKEN` con `openssl rand -base64 32` (minimo 16 caratteri). `MOTS_CORS_ORIGINS` è l'elenco di origini browser separate da virgola. Per OpenRouter, Vercel o NVIDIA sostituisci `KILO_API_KEY` con `OPENROUTER_API_KEY`, `AI_GATEWAY_API_KEY` o `NVIDIA_API_KEY`, e se serve imposta `MOTS_PROVIDER` con `bunx wrangler secret put MOTS_PROVIDER --env staging`. Non fare il deploy finché l'app mobile non invia il bearer di creazione: un client vecchio riceve `401`.

Il deploy manuale, quando quei secret ci sono e l'app invia il bearer, è `bunx wrangler deploy --env staging`. L'app non punta da sola a staging né a produzione: il default resta `http://localhost:8787` (Android emulator: `http://10.0.2.2:8787`). Per provare `mots-staging`, incolla il suo URL nel campo Server.

## Configurazione

| Variabile | Dove | Descrizione |
| --- | --- | --- |
| `MOTS_SESSION_SECRET` | server | Segreto HMAC dei codici di sessione. Minimo 16 caratteri. Obbligatorio. |
| `MOTS_CREATE_TOKEN` | server | Bearer richiesto da `POST /api/sessions`. Minimo 16 caratteri. Obbligatorio. |
| `MOTS_CORS_ORIGINS` | server | Origini browser separate da virgola. Vuoto o `*` consente ogni origine. Le app native non inviano `Origin`. |
| `MOTS_CREATE_LIMIT` | server | Creazioni per indirizzo nella finestra. Default `8`. Valori non validi restano sul default. |
| `MOTS_CREATE_WINDOW_SECONDS` | server | Finestra delle creazioni, in secondi. Default `600`. |
| `MOTS_CONNECT_LIMIT` | server | Tentativi di connessione per indirizzo. Default `60`. |
| `MOTS_CONNECT_WINDOW_SECONDS` | server | Finestra delle connessioni, in secondi. Default `60`. |
| `MOTS_MAX_SCHEDULES` | server | Routine attive non terminate. Default `8`, tra `1` e `100`. |
| `MOTS_MIN_RECURRENCE_SECONDS` | server | Distanza minima di una ricorrenza nuova. Default `900`. Il pavimento è `60`. |
| `MOTS_PROVIDER` | server | Provider LLM: `kilo` (predefinito se assente), `openrouter`, `vercel-ai-gateway` o `nvidia`. Un valore sconosciuto è un errore. |
| `MOTS_MODEL` | server | Modello del provider scelto. Default: `reflection/beam-free` (Kilo e Vercel), `openai/gpt-6-luna` (OpenRouter), `nvidia/nemotron-3.5-lightning-30b-a3b` (NVIDIA). |
| `KILO_API_KEY` | server (`apps/server/.dev.vars` o secret Cloudflare) | Chiave del provider `kilo`. Non viene mai inviata al client. |
| `OPENROUTER_API_KEY` | server (`apps/server/.dev.vars` o secret Cloudflare) | Chiave del provider `openrouter`. Non viene mai inviata al client. |
| `AI_GATEWAY_API_KEY` | server (`apps/server/.dev.vars` o secret Cloudflare) | Chiave del provider `vercel-ai-gateway`. Non viene mai inviata al client. |
| `NVIDIA_API_KEY` | server (`apps/server/.dev.vars` o secret Cloudflare) | Chiave del provider `nvidia`. Non viene mai inviata al client. |
| `EXPO_PUBLIC_MOTS_API_URL` | build mobile | URL server precompilato nell'app. Modificabile anche dall'onboarding. |

`.dev.vars` è ignorato da git. Non committare mai chiavi API.

## Provider LLM

Il provider non è fissato nel codice: si seleziona con `MOTS_PROVIDER` e il modello con `MOTS_MODEL`. Un esaurimento di quota diventa così una modifica di configurazione, non di codice.

| `MOTS_PROVIDER` | Chiave API | Modello predefinito |
| --- | --- | --- |
| `kilo` (predefinito se assente) | `KILO_API_KEY` | `reflection/beam-free` |
| `openrouter` | `OPENROUTER_API_KEY` | `openai/gpt-6-luna` |
| `vercel-ai-gateway` | `AI_GATEWAY_API_KEY` | `reflection/beam-free` |
| `nvidia` | `NVIDIA_API_KEY` | `nvidia/nemotron-3.5-lightning-30b-a3b` |

`MOTS_MODEL` è opzionale: se non è impostato vale il modello predefinito del provider. La chiave viene letta solo lato server e non viene mai inviata al client.

### Perché il provider è configurabile

Il free tier di OpenRouter è tornato a essere un vincolo: la quota giornaliera dei modelli gratuiti si è esaurita (HTTP 429 `free-models-per-day`) e il progetto non poteva più fare richieste. Con il provider selezionabile dall'ambiente lo stesso problema si risolve cambiando due variabili, senza toccare il codice.

### Vercel AI Gateway

Ogni account Vercel team ha $5/mese di crediti AI Gateway gratuiti sul piano free. Il piano free espone inoltre un insieme di modelli con prezzo `$0` su input e output, che non consumano crediti a prescindere dal saldo.

Il gateway parla il dialetto OpenAI su `https://ai-gateway.vercel.sh/v1` e pubblica il catalogo modelli su `https://ai-gateway.vercel.sh/v1/models` senza autenticazione. Mots legge quel catalogo a runtime invece di usare uno snapshot locale, quindi un modello gratuito aggiunto in seguito da Vercel funziona senza modifiche al codice.

Modelli gratuiti (prezzo `$0` in input e output) verificati sul catalogo:

| Modello | Tool calling |
| --- | --- |
| `minimax/minimax-m3.1-flash` | sì |
| `nvidia/nemotron-3.5-lightning-free` | sì |
| `poolside/laguna-s-2.1-free` | sì |
| `reflection/beam-free` | sì |
| `stealth/glyph-cluster` | sì |
| `convaiinnovations/laya` | no |
| `convaiinnovations/laya-free` | no |

I tool dell'agente (`remember`, `forget`, `schedule`, `search_history`) richiedono il supporto del tool calling: i due modelli `laya` non lo espongono e non sono utilizzabili, e vengono scartati in automatico quando il catalogo viene caricato.

`reflection/beam` ha anch'esso prezzo `$0` nel catalogo, ma il prezzo dipende dal provider che serve la richiesta (`varies_by_provider`), quindi non è garantito che sia gratuito: `bun run gateway:models` lo esclude per questo motivo.

## Comandi

| Comando | Cosa fa |
| --- | --- |
| `bun install` | Installa tutti i workspace. |
| `bun run setup` | Crea `.dev.vars` con i segreti e copia il token in `apps/mobile/.env.local`. |
| `bun run dev` | `setup`, poi server su Node e Expo insieme, con l'indirizzo LAN già impostato. `--web` apre il browser. |
| `bun run dev:server` | Avvia Wrangler in locale sulla porta 8787. |
| `bun run dev:server:lan` | Avvia Wrangler su `0.0.0.0:8787` per il telefono. |
| `bun run dev:mobile` | Avvia Expo. |
| `bun run dev:web` | Avvia l'anteprima web di Expo. |
| `bun run typecheck` | Typecheck di tutti i package. |
| `bun run test` | 274 test: protocollo, client, agent, gate del Worker e funzioni pure del mobile. |
| `bun run check` | Typecheck + dry-run del Worker. |
| `bun run check:server` | Solo `wrangler deploy --dry-run --env=""`. Resta sul Worker `mots`. |
| `bun run check:server:staging` | Dry-run di `wrangler deploy --env staging`. Non pubblica. |
| `bun run build:mobile` | Export Android con Metro. |
| `bun run --cwd apps/server deploy` | Deploy del Worker `mots` (`wrangler deploy --env=""`). Non è lo staging. |

## API

| Metodo | Percorso | Descrizione |
| --- | --- | --- |
| `GET` | `/api/health` | Health check. |
| `POST` | `/api/sessions` | Emette un codice firmato. Richiede `Authorization: Bearer <MOTS_CREATE_TOKEN>`. Risponde `201` con `{ sessionId, url, socketPath }`. `sessionId` è il codice intero. Non crea il Durable Object. |
| `GET` | `/api/sessions/:id` | Upgrade WebSocket. `:id` deve essere il codice firmato. Il nome del Durable Object è solo l'uuid, dopo la verifica. |

Il protocollo applicativo vive in `packages/protocol`: comandi client (`conversation.open`, `conversation.create`, `conversation.fork`, `prompt.submit`, `conversation.setModel`, `presence.typing`) ed eventi server (snapshot, eventi conversazione, inbox, presenza, risultati comandi, errori).

## Tool dell'agente

| Tool | Funzione |
| --- | --- |
| `remember` | Salva un fatto o una preferenza durevole (max 100, deduplicati). |
| `forget` | Rimuove le memorie che corrispondono a una frase. |
| `schedule` | Programma un'istruzione nel futuro, con ricorrenza e timezone. |
| `search_history` | Cerca nelle conversazioni passate tramite subagent. |
| `fetch_page` | Legge il testo di una pagina web pubblica (solo http/https, niente indirizzi privati, massimo 512 KB letti). |

La persona dell'agente, l'orologio e la memoria vengono iniettati come sezioni del contesto. I messaggi utente possono includere `[Nome]` come attribuzione del parlante.

## Stato e prossimi passi

- [x] Monorepo Bun + TypeScript con workspace.
- [x] Protocollo, client SDK e reducer condivisi.
- [x] Worker + Durable Object con SQLite, WebSocket e alarm.
- [x] Agente con memoria, promemoria e ricerca. Provider predefinito: Kilo. Alternative da ambiente: OpenRouter, Vercel AI Gateway, NVIDIA.
- [x] App mobile con onboarding, chat, sessioni e fork.
- [x] Typecheck, dry-run Worker, bundle Android.
- [x] Suite automatica (`bun run test`, 274 test): protocollo, client, agent, gate del Worker e funzioni pure del mobile.
- [x] Verifica end-to-end locale: health, creazione sessione, WebSocket e nuova conversazione.
- [x] Gate di sessione: codice firmato, token di creazione, rate limit per isolate, CORS da ambiente, allowlist di `conversation.setModel`, tetto sul numero di routine e sulla cadenza. Non sono account utente.
- [ ] Notifiche push per i promemoria.
- [ ] Markdown, immagini e messaggi vocali.
- [ ] Build iOS e deploy demo.

Per seguire l'avanzamento: questa sezione, `git log --oneline` e i comandi di verifica qui sopra.

## Sicurezza e limiti dell'MVP

- Creare una sessione richiede `MOTS_CREATE_TOKEN`. Aprire una sessione richiede il codice firmato con `MOTS_SESSION_SECRET`. Un uuid nudo, o una firma alterata, risponde `401` e non crea il Durable Object.
- Il codice condiviso resta il modo di entrare: chi lo possiede può connettersi, senza il token di creazione. Va trattato come un segreto.
- `MOTS_CREATE_TOKEN` dentro un binario pubblico si può estrarre. Ferma i client anonimi su internet, non chi spacchetta l'app. Gli account utente non ci sono ancora.
- CORS: senza `MOTS_CORS_ORIGINS`, o con `*`, ogni origine è ammessa. Un elenco esplicito rimanda solo quelle origini e risponde `403` alle altre. Una richiesta senza `Origin` (app nativa, curl) passa.
- I rate limit sono per isolate del Worker, non globali. I default sono 8 creazioni ogni 10 minuti e 60 connessioni al minuto, per `CF-Connecting-IP` (in locale, `local`). Davanti a un hostname pubblico serve anche un rate limit di edge.
- `conversation.setModel` accetta solo un provider Mots il cui modello è nel catalogo registrato. Il rifiuto è `command.result` con `error.code` `model_not_allowed`.
- Le routine nuove non possono essere più di `MOTS_MAX_SCHEDULES` (default 8) tra i task di consegna non terminati, e una ricorrenza nuova non può essere più frequente di `MOTS_MIN_RECURRENCE_SECONDS` (default 15 minuti, mai sotto i 60 secondi). Un one-shot resta da 1 secondo. La ricorrenza già creata continua, anche se era al minuto: il successore è ammesso finché il task sorgente è ancora aperto.
- La chiave API del provider resta lato server.
- I dati non sono cifrati end-to-end: sono nello storage del Durable Object.
- Mots non è un servizio pubblico finché i due segreti non sono impostati, l'app invia il bearer, e un rate limit di edge copre il hostname.

## Mobile client adoption

The mobile app adopts this gate. `packages/client` does not take a new socket parameter. The contract is:

1. `POST /api/sessions` must send `Authorization: Bearer <MOTS_CREATE_TOKEN>`. Keep reading `sessionId` from the JSON body. That string is now the full join code (`{uuid}_{hmac}`, 80 characters, alphabet `[A-Za-z0-9_-]`). Store it unchanged. Do not strip the signature, lowercase it, or keep only the uuid.
2. The WebSocket URL stays `/api/sessions/${sessionId}`. `MotsClient` already builds that path. No query parameter and no second header on the socket.
3. Share and join the full `sessionId`. `parseJoinTarget` already accepts it. Joining does not send the create token.
4. A bare uuid saved by a current install is rejected with `401`. Send that person through onboarding again. Do not add a legacy bypass.
5. `conversation.setModel` can now fail with `command.result` `ok: false` and `error.code === "model_not_allowed"`. The protocol shape is unchanged. The reducer stores `event.error.message` on `state.error`, and the chat banner shows the Italian refusal. The header pill stays on `snapshot.agent.model` until the server reports that model.
6. A schedule over the cap, or a new recurrence under the minimum cadence, fails inside the tool. No client frame changes.
7. Native apps send no `Origin`, so CORS does not affect them. A web preview must use an origin listed in `MOTS_CORS_ORIGINS` once that variable is set. Until it is set, every origin is allowed.
8. `429` bodies are `{ error: "rate_limited", message }` and include a `Retry-After` header in seconds. `401` is `{ error: "unauthorized", message }`. `503` means a server secret is missing (`session_secret_unconfigured` or `create_token_unconfigured`).
9. `EXPO_PUBLIC_MOTS_CREATE_TOKEN`, when set, is compiled into the app bundle. It is not a confidential secret. It only stops callers who do not have the app. When it is unset, `createSession` omits `Authorization`. This Worker still requires the bearer: a request without it is `401`, and a server without `MOTS_CREATE_TOKEN` is `503`.
10. The share sheet and the session menu show the entire `sessionId`. A sliced label is not a join code.

`apps/mobile/src/api.ts` `createSession` sends the bearer when `EXPO_PUBLIC_MOTS_CREATE_TOKEN` is set. A plain `GET` of the socket path distinguishes `426` (open the socket), `401` (offer a new space or a join), and `503` / `429` / `403` (the server is not ready). Any other result, including a network failure, still tries the socket. `apps/mobile/src/storage.ts` already accepts the new code shape.

## Licenza

MIT. Vedi [LICENSE](LICENSE).

Costruito studiando [pi-durable-cloudflare](https://github.com/earendil-works/pi-durable-cloudflare) e i package [Pi](https://github.com/earendil-works/pi).
