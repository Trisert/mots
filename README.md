# Mots

Mots è un compagno AI che sta in tasca. Ricorda le cose importanti, ti avvisa al momento giusto, cerca nelle conversazioni passate e legge le pagine web quando glielo chiedi.

Ogni conversazione è una **sessione** che vive in un Cloudflare Durable Object. L'agente resta sempre disponibile, ma quando nessuno gli scrive il Durable Object va in hibernation e non consuma risorse: il costo per una sessione inattiva è vicino a zero. L'app mobile è un client come gli altri. Il progetto è open source e l'architettura non dipende da un unico client: il protocollo è pensato per accogliere anche altri canali.

> **Stato: MVP in sviluppo attivo.** Il monorepo è funzionante: typecheck, 328 test (`bun run test`), dry-run del Worker e bundle Android. Mancano ancora gli account utente, una copertura end-to-end con un LLM reale e un deploy pubblico. Il Worker rifiuta le sessioni anonime. Il piano completo è in [docs/ROADMAP.md](docs/ROADMAP.md).

## Cosa fa oggi

- **Chat in streaming** dall'app Expo: onboarding, creazione o ingresso in uno spazio, lista delle conversazioni, fork da un messaggio, stato di connessione e riconnessione automatica.
- **Memoria durevole** per sessione. Preferenze e fatti sopravvivono alle conversazioni, e puoi chiedere di dimenticarli.
- **Promemoria e routine** programmati nel tempo, con ricorrenza e fuso orario. Si risvegliano con gli alarm del Durable Object.
- **Ricerca nella storia** delle conversazioni, affidata a un subagent.
- **Web senza chiavi.** `fetch_page` legge una pagina pubblica. `web_search` cerca sul web con Exa e Parallel, che non richiedono chiave. Con `TAVILY_API_KEY` usa Tavily.
- **Scelta del modello** dall'app, tra i modelli dei provider configurati sul server. Le chiavi restano sul server.
- **Outbox offline.** Creazioni, fork, messaggi e cambi di modello restano in coda se la connessione cade e vengono ritentati alla riconnessione.

## Architettura

```
┌──────────────────────────────┐
│ App Expo (apps/mobile)       │
│ onboarding · chat · sessioni │
└──────────────┬───────────────┘
               │ WebSocket /api/sessions/:codice
┌──────────────▼───────────────┐
│ Worker (apps/server)         │
│ CORS · health · nuove sessioni│
└──────────────┬───────────────┘
               │ Durable Object, binding SESSIONS
┌──────────────▼───────────────┐
│ Session (uno per sessione)   │
│ SQLite · WebSocket · alarm   │
│ Pi Durable Harness           │
│  └─ @mots/agent              │
│      ├─ provider LLM         │
│      ├─ memoria              │
│      ├─ promemoria           │
│      ├─ web                  │
│      └─ ricerca storia       │
└──────────────────────────────┘
        @mots/protocol · @mots/client
```

- Una **sessione** è un codice firmato, formato da un uuid e da una firma HMAC. L'uuid è il nome del Durable Object. La firma è ciò che autorizza l'apertura.
- `POST /api/sessions` emette il codice e non crea il Durable Object. Il Durable Object nasce solo quando un WebSocket presenta un codice valido.
- Il client riceve snapshot, eventi dell'agente, presenza e conferme dei comandi.
- Lo storage del Durable Object (SQLite) è la fonte di verità. L'app è una proiezione di quello stato.

## Struttura del repository

```
apps/
  mobile/    App Expo + React Native       (guida: apps/mobile/README.md)
  server/    Worker Cloudflare + Durable Object (guida: apps/server/README.md)
packages/
  protocol/  Tipi e validazione del protocollo wire, senza I/O
  client/    MotsClient, reducer di stato, outbox dei comandi
  agent/     Harness Pi, provider LLM, memoria, promemoria, ricerca e web
docs/
  ROADMAP.md      piano di prodotto e stato dei task
  ANALYSIS.md     audit tecnico
```

Per le regole di lavoro sul codice vedi [AGENTS.md](AGENTS.md).

## Avvio rapido

Servono [Bun](https://bun.sh/) 1.4 o successivo e [Node.js](https://nodejs.org/) 22 o successivo nel `PATH`. Node serve a Wrangler: se viene avviato dal runtime di Bun, `wrangler dev` risponde `503`.

Dalla cartella del repository:

```bash
bun install
bun run dev
```

`bun run dev` prepara l'ambiente e avvia tutto in un solo terminale:

1. Crea `apps/server/.dev.vars` dall'esempio, se manca, e genera `MOTS_SESSION_SECRET` e `MOTS_CREATE_TOKEN` quando sono vuoti o troppo corti. I valori già validi non cambiano, quindi i codici già condivisi restano validi.
2. Copia lo stesso token in `apps/mobile/.env.local`, che Expo legge da solo.
3. Avvia il server con Node su `0.0.0.0:8787` e attende che `/api/health` risponda.
4. Avvia Expo con il server già impostato sull'indirizzo di rete del computer, e stampa gli indirizzi da aprire sul telefono.

Con Expo avviato, inquadra il QR code con Expo Go, oppure premi `w` per il browser. `bun run dev --web` apre subito l'anteprima web. Ctrl+C ferma sia Expo sia il server.

Se il telefono non si collega, consenti Node.js nel firewall per le reti private. Se la rete isola i dispositivi (reti pubbliche, eduroam), usa un emulatore o un tunnel HTTPS.

`bun run setup` esegue solo la preparazione, senza avviare nulla. I file `.dev.vars` e `.env.local` sono ignorati da git e non vanno mai committati.

### Configurazione manuale

```bash
cp apps/server/.dev.vars.example apps/server/.dev.vars
```

Servono due segreti di almeno 16 caratteri, generati con `openssl rand -base64 32`:

```dotenv
MOTS_SESSION_SECRET=...   # firma i codici di ingresso: ruotarlo invalida i codici già condivisi
MOTS_CREATE_TOKEN=...     # bearer di POST /api/sessions
# KILO_API_KEY=...        # facoltativa: senza, Kilo usa il piano gratuito
# MOTS_MODEL=reflection/beam-free
```

Scrivi lo stesso valore di `MOTS_CREATE_TOKEN` in `apps/mobile/.env.local`, altrimenti il server risponde `401` alla creazione di uno spazio:

```dotenv
EXPO_PUBLIC_MOTS_CREATE_TOKEN=...
```

Poi avvia server e app in due terminali:

```bash
bun run dev:server
bun run dev:mobile
```

- Server locale: `http://localhost:8787`, con `GET /api/health`.
- Se `/api/health` risponde `503`, verifica che `node --version` funzioni e che Node preceda Bun nel `PATH`. Un `503` su `POST /api/sessions`, con il server già su Node, indica un segreto mancante.
- In app premi **Crea uno spazio**. Il campo Server è modificabile e viene salvato con l'identità.
- Emulatore Android: `http://10.0.2.2:8787`, già predefinito. Simulatore iOS: `http://localhost:8787`.
- Telefono fisico sulla stessa rete: avvia `bun run dev:server:lan`, poi inserisci l'indirizzo LAN del computer, per esempio `http://192.168.1.10:8787`.

Per provare l'interfaccia nel browser:

```bash
bun run dev:web
```

L'anteprima usa `http://localhost:8787`. Su una macchina remota imposta `EXPO_PUBLIC_MOTS_API_URL` prima di avviarla.

## Sul telefono

Il telefono non raggiunge `localhost`: gli serve un Worker distribuito su Cloudflare. Il codice è pronto. Restano i passi che richiedono il tuo account Cloudflare e, per l'app installata, il tuo account Expo.

**1. Distribuisci il Worker**, una volta sola, seguendo [Deploy su Cloudflare](#deploy-su-cloudflare). Annota l'URL, per esempio `https://mots.<tuo-sottodominio>.workers.dev`. Il valore di `MOTS_CREATE_TOKEN` deve essere identico nel secret del Worker, in `apps/server/.dev.vars` e nel build del telefono.

**2a. Con Expo Go** (gratis, iPhone o Android). Il computer deve restare acceso con Expo avviato, perché il telefono carica l'app da lì. Le sessioni passano dal Worker distribuito:

```bash
EXPO_PUBLIC_MOTS_API_URL=https://mots.<tuo-sottodominio>.workers.dev bun run dev
```

Inquadra il QR code. Nell'onboarding il campo Server, sotto **Avanzate**, deve già contenere l'URL del Worker.

**2b. Come app installata su Android**, senza computer acceso. Serve un account Expo gratuito. La procedura, con le variabili d'ambiente EAS, è in [apps/mobile/README.md](apps/mobile/README.md). Al termine EAS mostra il link dell'APK: aprilo dal telefono e consenti l'installazione da quell'origine.

**2c. iPhone installato** richiede il Programma per sviluppatori Apple a pagamento e la registrazione del dispositivo. Il percorso gratuito è Expo Go.

**Se non si collega:**

- `401`, "il permesso di creazione manca": il token dell'app non coincide con quello del Worker.
- "Non riesco a raggiungere il server": l'URL è sbagliato, il Worker non è distribuito, oppure il campo Server contiene ancora `localhost`.
- `503`: manca un secret sul Worker. Controlla con `bunx wrangler secret list --env=""`.

## Deploy su Cloudflare

```bash
cd apps/server
bunx wrangler secret put MOTS_SESSION_SECRET --env=""
bunx wrangler secret put MOTS_CREATE_TOKEN --env=""
bunx wrangler secret put KILO_API_KEY --env=""
bunx wrangler deploy --env=""
```

`--env=""` seleziona il Worker di primo livello, `mots`. Senza quel flag Wrangler sceglie anche l'ambiente `staging`, che è un Worker diverso.

Per OpenRouter, Vercel AI Gateway o NVIDIA, sostituisci `KILO_API_KEY` con la chiave del provider e imposta `MOTS_PROVIDER` con `bunx wrangler secret put MOTS_PROVIDER --env=""`. Un valore sconosciuto fa fallire l'avvio della sessione.

Non fare il deploy finché l'app non invia il bearer di creazione: un client vecchio riceverebbe `401`.

### Staging

`apps/server/wrangler.jsonc` definisce l'ambiente `staging`, con il Worker `mots-staging`. I suoi secret si impostano con `--env staging`:

```bash
cd apps/server
bunx wrangler secret put MOTS_SESSION_SECRET --env staging
bunx wrangler secret put MOTS_CREATE_TOKEN --env staging
bunx wrangler secret put MOTS_CORS_ORIGINS --env staging
bunx wrangler secret put KILO_API_KEY --env staging
bunx wrangler deploy --env staging
```

La CI esegue solo il dry-run di staging (`bun run check:server:staging`) e non pubblica nulla. L'app non punta da sola a staging: per provarlo incolla il suo URL nel campo Server.

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
| `MOTS_MIN_RECURRENCE_SECONDS` | server | Distanza minima di una nuova ricorrenza. Default `900`. Il minimo assoluto è `60`. |
| `MOTS_PROVIDER` | server | Provider LLM: `kilo` (predefinito se assente), `openrouter`, `vercel-ai-gateway` o `nvidia`. Un valore sconosciuto è un errore. |
| `MOTS_MODEL` | server | Modello del provider scelto. Se manca, vale il default del provider (vedi la tabella dei provider). |
| `KILO_API_KEY` | server | Chiave del provider `kilo`. Non viene mai inviata al client. |
| `OPENROUTER_API_KEY` | server | Chiave del provider `openrouter`. Non viene mai inviata al client. |
| `AI_GATEWAY_API_KEY` | server | Chiave del provider `vercel-ai-gateway`. Non viene mai inviata al client. |
| `NVIDIA_API_KEY` | server | Chiave del provider `nvidia`. Non viene mai inviata al client. |
| `TAVILY_API_KEY` | server | Facoltativa. Fa usare a `web_search` Tavily invece di Exa e Parallel. Non viene mai inviata al client. |
| `EXPO_PUBLIC_MOTS_API_URL` | build mobile | URL del server precompilato nell'app. Non è un segreto, e resta modificabile dall'onboarding. |
| `EXPO_PUBLIC_MOTS_CREATE_TOKEN` | build mobile | Token di creazione incluso nel bundle. Serve come cancello per l'app, non come segreto personale. |

`.dev.vars` è ignorato da git. Non committare mai chiavi API.

## Provider LLM

Il provider non è fissato nel codice: si sceglie con `MOTS_PROVIDER` e il modello con `MOTS_MODEL`. Se un provider esaurisce la quota, basta cambiare due variabili d'ambiente.

| `MOTS_PROVIDER` | Chiave | Modello predefinito |
| --- | --- | --- |
| `kilo` (predefinito se assente) | `KILO_API_KEY` | `reflection/beam-free` |
| `openrouter` | `OPENROUTER_API_KEY` | `openai/gpt-6-luna` |
| `vercel-ai-gateway` | `AI_GATEWAY_API_KEY` | `reflection/beam-free` |
| `nvidia` | `NVIDIA_API_KEY` | `nvidia/nemotron-3.5-lightning-30b-a3b` |

Con `KILO_API_KEY` assente, il processo locale può leggere `~/.pi/agent/auth.json`, oppure inviare la chiave letterale `free`. Il file locale è una comodità di sviluppo e non va copiato nel repository.

L'app mostra solo i modelli che la sessione può usare: il provider scelto, Kilo (solo modelli gratuiti senza chiave) e ogni provider con la chiave impostata.

### Vercel AI Gateway

Il gateway parla il dialetto OpenAI su `https://ai-gateway.vercel.sh/v1` e pubblica il catalogo su `https://ai-gateway.vercel.sh/v1/models` senza autenticazione. Mots legge il catalogo a runtime, quindi un nuovo modello gratuito funziona senza modifiche al codice.

Modelli a prezzo `$0` in input e output, verificati sul catalogo:

| Modello | Tool calling |
| --- | --- |
| `minimax/minimax-m3.1-flash` | sì |
| `nvidia/nemotron-3.5-lightning-free` | sì |
| `poolside/laguna-s-2.1-free` | sì |
| `reflection/beam-free` | sì |
| `stealth/glyph-cluster` | sì |
| `convaiinnovations/laya` | no |
| `convaiinnovations/laya-free` | no |

I tool dell'agente richiedono il tool calling, quindi i due modelli `laya` vengono scartati automaticamente. `reflection/beam` ha prezzo `$0` nel catalogo, ma il prezzo dipende dal provider che serve la richiesta, perciò `bun run gateway:models` lo esclude.

## Tool dell'agente

| Tool | Funzione |
| --- | --- |
| `remember` | Salva un fatto o una preferenza durevole. Al massimo 100, deduplicati. |
| `forget` | Rimuove le memorie che corrispondono a una frase. Se la corrispondenza è ambigua, elenca i candidati e non cancella nulla. |
| `schedule` | Programma un'istruzione nel futuro, con ricorrenza e fuso orario. |
| `search_history` | Cerca nelle conversazioni passate, tramite subagent. |
| `fetch_page` | Legge il testo di una pagina web pubblica (solo http/https). Rifiuta indirizzi privati e locali, controlla ogni redirect, legge al massimo 512 KB. |
| `web_search` | Cerca sul web e restituisce fino a 5 risultati con titolo, URL e un estratto di al massimo 600 caratteri. Di default usa Exa e Parallel a turno, senza chiave: se uno dei due limita o rifiuta, prova l'altro. Con `TAVILY_API_KEY` usa Tavily. |

La persona dell'agente, l'orologio e la memoria vengono iniettati come sezioni del contesto. I messaggi utente possono includere `[Nome]` per indicare chi parla.

## Comandi

| Comando | Cosa fa |
| --- | --- |
| `bun install` | Installa tutti i workspace. |
| `bun run setup` | Crea `.dev.vars` con i segreti e copia il token in `apps/mobile/.env.local`. |
| `bun run dev` | Esegue `setup`, poi server su Node ed Expo insieme. `--web` apre il browser. |
| `bun run dev:server` | Avvia Wrangler in locale sulla porta 8787. |
| `bun run dev:server:lan` | Avvia Wrangler su `0.0.0.0:8787`, per il telefono. |
| `bun run dev:mobile` | Avvia Expo. |
| `bun run dev:web` | Avvia l'anteprima web di Expo. |
| `bun run typecheck` | Typecheck di tutti i workspace. |
| `bun run test` | 328 test: protocollo, client, agent, gate del Worker e funzioni pure dell'app. |
| `bun run check` | Typecheck e dry-run del Worker. È il controllo da passare prima di una PR. |
| `bun run check:server` | Dry-run del Worker `mots`. |
| `bun run check:server:staging` | Dry-run del Worker `mots-staging`. Non pubblica. |
| `bun run build:mobile` | Export Android con Metro. |

## API

| Metodo | Percorso | Descrizione |
| --- | --- | --- |
| `GET` | `/api/health` | Health check. |
| `POST` | `/api/sessions` | Emette un codice firmato. Richiede `Authorization: Bearer <MOTS_CREATE_TOKEN>`. Risponde `201` con `{ sessionId, url, socketPath }`. Non crea il Durable Object. |
| `GET` | `/api/sessions/:codice` | Upgrade a WebSocket. Il codice deve essere quello firmato. |
| `GET` | `/api/sessions/:codice/models` | Modelli che la sessione può selezionare. |

Il protocollo vive in `packages/protocol`. I comandi client sono `conversation.open`, `conversation.create`, `conversation.fork`, `prompt.submit`, `conversation.setModel` e `presence.typing`. Gli eventi server coprono snapshot, eventi della conversazione, inbox, presenza, esiti dei comandi ed errori.

## Sicurezza e limiti dell'MVP

- Creare una sessione richiede `MOTS_CREATE_TOKEN`. Aprire una sessione richiede il codice firmato con `MOTS_SESSION_SECRET`. Un uuid nudo, o una firma alterata, riceve `401` e non apre il Durable Object.
- Chi possiede il codice condiviso può entrare nella sessione senza il token di creazione. Trattalo come un segreto.
- `MOTS_CREATE_TOKEN` dentro un'app pubblica si può estrarre. Ferma i client anonimi, ma non chi decompila l'app. Gli account utente non ci sono ancora.
- Senza `MOTS_CORS_ORIGINS`, o con `*`, ogni origine è ammessa. Un elenco esplicito risponde `403` alle altre origini. Una richiesta senza `Origin` (app nativa, curl) passa.
- I rate limit sono per isolate del Worker, non globali, e usano `CF-Connecting-IP`. Davanti a un hostname pubblico serve anche un rate limit a livello di edge.
- `conversation.setModel` accetta solo modelli presenti nel catalogo registrato. Il rifiuto è `command.result` con `error.code` `model_not_allowed`.
- Le routine sono limitate da `MOTS_MAX_SCHEDULES` e da `MOTS_MIN_RECURRENCE_SECONDS`. I promemoria una tantum non sono soggetti al minimo di ricorrenza.
- Le chiavi dei provider restano sul server.
- I dati non sono cifrati end-to-end: stanno nello storage del Durable Object.
- Mots non è un servizio pubblico finché i due segreti non sono impostati, l'app invia il bearer e un rate limit di edge copre l'hostname.

## Documentazione per chi sviluppa

- [AGENTS.md](AGENTS.md): regole operative per chi modifica il repository, comandi di verifica e convenzioni.
- [apps/mobile/README.md](apps/mobile/README.md): app Expo, build EAS per Android e iOS, variabili pubbliche.
- [apps/server/README.md](apps/server/README.md): Worker, Durable Object, route e segreti.
- [docs/ROADMAP.md](docs/ROADMAP.md): piano di prodotto, stato dei task e design delle prossime fasi.
- [docs/ANALYSIS.md](docs/ANALYSIS.md): audit tecnico e descrizione dei task M.
- [docs/CLAUDE_PROJECT.md](docs/CLAUDE_PROJECT.md): come riprendere il lavoro da un Claude Project.

## Stato e prossimi passi

- [x] Monorepo Bun e TypeScript, con protocollo, client SDK e reducer condivisi.
- [x] Worker e Durable Object con SQLite, WebSocket hibernabili e alarm.
- [x] Agente con memoria, promemoria, ricerca nella storia, `fetch_page` e `web_search`.
- [x] App mobile con onboarding, chat, sessioni, fork, scelta del modello e outbox offline.
- [x] Build Android con EAS (profilo `preview`).
- [x] Suite automatica: 328 test. Typecheck e dry-run in CI.
- [ ] Notifiche push per i promemoria: il server le invia, la registrazione nell'app è ancora da fare (M15).
- [ ] Immagini e messaggi vocali (M17, M18).
- [ ] Account utente, copertura end-to-end con un LLM reale e deploy pubblico.

## Licenza

MIT. Vedi [LICENSE](LICENSE).

Costruito studiando [pi-durable-cloudflare](https://github.com/earendil-works/pi-durable-cloudflare) e i pacchetti [Pi](https://github.com/earendil-works/pi).
