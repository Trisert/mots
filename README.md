# Mots

Mots is a mobile-first AI companion: it remembers what matters, organizes reminders, searches past conversations, and stays in your pocket. The goal is a platform-agnostic architecture with a mobile app as the first client, built on [Pi Durable](https://github.com/earendil-works/pi/tree/main/packages/durable) and Cloudflare Durable Objects.

> **Status: MVP under active development.** Working monorepo. Typecheck for every workspace, the `bun run test` suite (274 tests), the Worker dry-run, and the Android bundle are verified. The Worker rejects anonymous sessions. User accounts, end-to-end coverage with a real LLM, and a public deploy are the next steps.

## What is already here

- **Expo mobile app** with onboarding, creating and joining a session, streaming chat, a conversation list, sharing the session code, forking from a message, and connection status.
- **Cloudflare Worker server** with one session per Durable Object, SQLite storage, hibernating WebSockets, and alarms.
- **Mots agent** built on the Pi Durable harness, with a configurable LLM provider. If `MOTS_PROVIDER` is missing, the code uses Kilo. OpenRouter, Vercel AI Gateway, and NVIDIA are selected from the environment.
- **Durable memory** per session: preferences and facts survive across conversations.
- **Reminders** scheduled with the `schedule` tool, with recurrence and wake-ups through alarms.
- **History search** across past conversations through a subagent.
- **Shared client SDK** with automatic reconnection, an outbox that retries commands already sent but not yet acknowledged, and React state compatible with `useSyncExternalStore`.

## Architecture

```
┌──────────────────────────────┐
│ Expo app (@mots/mobile)      │
│ onboarding · chat · sessions │
└──────────────┬───────────────┘
               │ WebSocket /api/sessions/:id
┌──────────────▼───────────────┐
│ Worker (@mots/server)        │
│ CORS · health · new sessions │
└──────────────┬───────────────┘
               │ Durable Object binding SESSIONS
┌──────────────▼───────────────┐
│ Session (1 per session)      │
│ SQLite · WebSocket · alarm   │
│ Pi Durable Harness           │
│  └─ @mots/agent              │
│      ├─ LLM provider         │
│      ├─ memory              │
│      ├─ reminders           │
│      └─ history search      │
└──────────────────────────────┘
        @mots/protocol · @mots/client
```

- A **session** is a signed code (`uuid` + HMAC). The uuid is the Durable Object name; the signature is what authorizes opening it.
- `POST /api/sessions` issues the code and does not create the Durable Object. The DO is created only when a WebSocket presents a valid code.
- The client opens a WebSocket and receives snapshots, agent events, presence, and command acknowledgements.
- Create, fork, prompt, and `conversation.setModel` stay in the outbox after a successful send. A confirmed prompt carries a `submissionId`.
- Reminders use Durable Object alarms; memory uses a Pi document scoped to the session.

## Repository layout

```
apps/
  mobile/    Expo + React Native app
  server/    Cloudflare Worker + Durable Object
packages/
  protocol/  Types and validation for the wire protocol
  client/    MotsClient, state reducer, outbox
  agent/     Pi harness, LLM providers, tools and sections
```

## Requirements

- [Bun](https://bun.sh/) 1.4 or later for install, typecheck, tests, and Expo.
- [Node.js](https://nodejs.org/) 22 or later on the `PATH` to run Wrangler. Wrangler does not work when launched by the Bun runtime: in that case `wrangler dev` responds `503`.
- An API key for the chosen provider. The default is Kilo. Alternatives are [OpenRouter](https://openrouter.ai/keys), Vercel AI Gateway (`AI_GATEWAY_API_KEY`, host `https://ai-gateway.vercel.sh/v1`), or NVIDIA. See [LLM providers](#llm-providers).
- For a phone: Expo Go, or an Android emulator / iOS simulator.
- A Cloudflare account, only for deploying the Worker.

The repository uses Bun as its package manager and does not require npm. Native builds (EAS / Xcode / Android Studio) may need their own toolchains.

## Quick start

Two commands, from the repository folder:

```powershell
bun install
bun run dev
```

`bun run dev` prepares the environment and starts everything in one terminal:

1. Creates `apps/server/.dev.vars` from the example if it is missing, and generates `MOTS_SESSION_SECRET` and `MOTS_CREATE_TOKEN` if they are empty or too short. Values that already work are kept as they are, so join codes stay valid.
2. Copies the same token into `apps/mobile/.env.local`, which Expo reads on its own. No `set` or `$env:` needed.
3. Starts the server with Node on `0.0.0.0:8787` and waits for `/api/health` to respond.
4. Starts Expo with the server already pointing at the computer's LAN address, and prints the addresses to open on the phone.

With Expo running, scan the QR code with Expo Go, or press `w` for the browser. `bun run dev --web` opens the web preview straight away. From the phone, on the same Wi-Fi, you can also open the `http://<computer IP>:8081` address printed at startup in a browser: the web app finds the server on the same host by itself. Ctrl+C stops both Expo and the server.

If the phone does not connect, allow Node.js through the firewall on private networks. If the network isolates devices, as public networks or eduroam do, use an emulator or an HTTPS tunnel.

`bun run setup` only prepares the environment, without starting anything. The `.dev.vars` and `.env.local` files are ignored by git and must never be committed.

### Manual setup

If you prefer to prepare the environment by hand:

```powershell
Copy-Item apps/server/.dev.vars.example apps/server/.dev.vars
```

Open `apps/server/.dev.vars`. Two secrets of at least 16 characters are required. Generate them with `openssl rand -base64 32` (twice), and do not reuse the empty example values from the repository. If `MOTS_PROVIDER` is missing, the code uses `kilo` and the model `reflection/beam-free` (`DEFAULT_MODELS` in `packages/agent/src/provider.ts`):

```dotenv
MOTS_SESSION_SECRET=...
MOTS_CREATE_TOKEN=...
# KILO_API_KEY=...
# MOTS_MODEL=reflection/beam-free
```

`MOTS_SESSION_SECRET` signs the join codes: rotating it invalidates every code already shared. `MOTS_CREATE_TOKEN` is the bearer for `POST /api/sessions`. Without either one the Worker responds `503` and opens no sessions. Without `KILO_API_KEY`, the local process may read `~/.pi/agent/auth.json`, or send the literal key `free`.

For another provider, set `MOTS_PROVIDER` and that provider's key. With `openrouter` the default model is `openai/gpt-6-luna`:

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

Provider details are in [LLM providers](#llm-providers).

Write the same value of `MOTS_CREATE_TOKEN` into `apps/mobile/.env.local`, otherwise the server rejects space creation with `401`:

```dotenv
EXPO_PUBLIC_MOTS_CREATE_TOKEN=...
```

Start the server and the app in two terminals:

```powershell
bun run dev:server
bun run dev:mobile
```

- Local server: `http://localhost:8787` (`GET /api/health`).
- If `GET /api/health` responds `503`, check that `node --version` works and that Node comes before Bun in the `PATH`: `wrangler dev` must run on Node. A `503` on `POST /api/sessions`, with the dev server already on Node, means `MOTS_SESSION_SECRET` or `MOTS_CREATE_TOKEN` is missing.
- In the app, press **Create a space**. The Server field is editable: it is the same value that onboarding saves with the identity.
- Android emulator: use `http://10.0.2.2:8787` (already the default).
- iOS simulator: `http://localhost:8787`.
- Physical phone on the same network: start `bun run dev:server:lan` (binding `0.0.0.0`), enter the computer's LAN address in the app, for example `http://192.168.1.10:8787`, and allow Node/Expo through the Windows firewall.
- If the network isolates devices (typical of public networks such as eduroam) or the firewall blocks the ports, use an HTTPS/WSS tunnel or an Android emulator.

To try the interface in a browser without a phone:

```powershell
bun run dev:web
```

The preview uses `http://localhost:8787` as the server; the URL stays editable from onboarding. On a remote machine, set `EXPO_PUBLIC_MOTS_API_URL` to the server's reachable URL before starting the web preview.

### Deploy to Cloudflare

```powershell
cd apps/server
bunx wrangler secret put MOTS_SESSION_SECRET --env=""
bunx wrangler secret put MOTS_CREATE_TOKEN --env=""
bunx wrangler secret put KILO_API_KEY --env=""
bunx wrangler deploy --env=""
```

`--env=""` is the top-level Worker, `mots`. Without that flag Wrangler warns, because the file also defines `staging`, and the command would stay on the `mots` Worker.

The default provider is `kilo`, with the model `reflection/beam-free`. For OpenRouter, Vercel, or NVIDIA, put `OPENROUTER_API_KEY`, `AI_GATEWAY_API_KEY`, or `NVIDIA_API_KEY` in place of `KILO_API_KEY`, and set `MOTS_PROVIDER` with `bunx wrangler secret put MOTS_PROVIDER --env=""`. If `MOTS_PROVIDER` is missing, the code uses `kilo`. An unknown value makes session startup fail. `MOTS_MODEL` is optional. Do not deploy until the mobile app sends the creation bearer: an old client gets `401`.

Then, in the app, use the Worker's public URL as the server. The app's default URL stays the local one.

### Staging

`apps/server/wrangler.jsonc` defines the `staging` environment. Its Worker is named `mots-staging` and is separate from `mots`. CI runs `wrangler deploy --dry-run --env staging` (`bun run check:server:staging`) next to the dry-run of the default Worker. That step publishes nothing.

Staging secrets are set with `--env staging`, from the `apps/server` folder. They do not go into git.

```powershell
cd apps/server
bunx wrangler secret put MOTS_SESSION_SECRET --env staging
bunx wrangler secret put MOTS_CREATE_TOKEN --env staging
bunx wrangler secret put MOTS_CORS_ORIGINS --env staging
bunx wrangler secret put KILO_API_KEY --env staging
```

Generate `MOTS_SESSION_SECRET` and `MOTS_CREATE_TOKEN` with `openssl rand -base64 32` (at least 16 characters). `MOTS_CORS_ORIGINS` is the comma-separated list of browser origins. For OpenRouter, Vercel, or NVIDIA, replace `KILO_API_KEY` with `OPENROUTER_API_KEY`, `AI_GATEWAY_API_KEY`, or `NVIDIA_API_KEY`, and if needed set `MOTS_PROVIDER` with `bunx wrangler secret put MOTS_PROVIDER --env staging`. Do not deploy until the mobile app sends the creation bearer: an old client gets `401`.

The manual deploy, once those secrets exist and the app sends the bearer, is `bunx wrangler deploy --env staging`. The app does not point at staging or production by itself: the default stays `http://localhost:8787` (Android emulator: `http://10.0.2.2:8787`). To try `mots-staging`, paste its URL into the Server field.

## Configuration

| Variable | Where | Description |
| --- | --- | --- |
| `MOTS_SESSION_SECRET` | server | HMAC secret for session codes. At least 16 characters. Required. |
| `MOTS_CREATE_TOKEN` | server | Bearer required by `POST /api/sessions`. At least 16 characters. Required. |
| `MOTS_CORS_ORIGINS` | server | Comma-separated browser origins. Empty or `*` allows every origin. Native apps do not send `Origin`. |
| `MOTS_CREATE_LIMIT` | server | Creations per address in the window. Default `8`. Invalid values keep the default. |
| `MOTS_CREATE_WINDOW_SECONDS` | server | Creation window, in seconds. Default `600`. |
| `MOTS_CONNECT_LIMIT` | server | Connection attempts per address. Default `60`. |
| `MOTS_CONNECT_WINDOW_SECONDS` | server | Connection window, in seconds. Default `60`. |
| `MOTS_MAX_SCHEDULES` | server | Active, unfinished routines. Default `8`, between `1` and `100`. |
| `MOTS_MIN_RECURRENCE_SECONDS` | server | Minimum distance for a new recurrence. Default `900`. The floor is `60`. |
| `MOTS_PROVIDER` | server | LLM provider: `kilo` (default if missing), `openrouter`, `vercel-ai-gateway`, or `nvidia`. An unknown value is an error. |
| `MOTS_MODEL` | server | Model for the chosen provider. Defaults: `reflection/beam-free` (Kilo and Vercel), `openai/gpt-6-luna` (OpenRouter), `nvidia/nemotron-3.5-lightning-30b-a3b` (NVIDIA). |
| `KILO_API_KEY` | server (`apps/server/.dev.vars` or Cloudflare secret) | Key for the `kilo` provider. Never sent to the client. |
| `OPENROUTER_API_KEY` | server (`apps/server/.dev.vars` or Cloudflare secret) | Key for the `openrouter` provider. Never sent to the client. |
| `AI_GATEWAY_API_KEY` | server (`apps/server/.dev.vars` or Cloudflare secret) | Key for the `vercel-ai-gateway` provider. Never sent to the client. |
| `NVIDIA_API_KEY` | server (`apps/server/.dev.vars` or Cloudflare secret) | Key for the `nvidia` provider. Never sent to the client. |
| `EXPO_PUBLIC_MOTS_API_URL` | mobile build | Server URL baked into the app. Also editable from onboarding. |

`.dev.vars` is ignored by git. Never commit API keys.

## LLM providers

The provider is not fixed in the code: it is selected with `MOTS_PROVIDER`, and the model with `MOTS_MODEL`. A quota running out becomes a configuration change, not a code change.

| `MOTS_PROVIDER` | API key | Default model |
| --- | --- | --- |
| `kilo` (default if missing) | `KILO_API_KEY` | `reflection/beam-free` |
| `openrouter` | `OPENROUTER_API_KEY` | `openai/gpt-6-luna` |
| `vercel-ai-gateway` | `AI_GATEWAY_API_KEY` | `reflection/beam-free` |
| `nvidia` | `NVIDIA_API_KEY` | `nvidia/nemotron-3.5-lightning-30b-a3b` |

`MOTS_MODEL` is optional: if it is not set, the provider's default model applies. The key is read only on the server and is never sent to the client.

### Why the provider is configurable

The OpenRouter free tier became a constraint again: the daily quota for free models ran out (HTTP 429 `free-models-per-day`) and the project could no longer make requests. With the provider selectable from the environment, the same problem is solved by changing two variables, without touching the code.

### Vercel AI Gateway

Every Vercel team account gets $5/month of free AI Gateway credits on the free plan. The free plan also exposes a set of models priced at `$0` for input and output, which do not consume credits whatever the balance.

The gateway speaks the OpenAI dialect at `https://ai-gateway.vercel.sh/v1` and publishes its model catalog at `https://ai-gateway.vercel.sh/v1/models` without authentication. Mots reads that catalog at runtime instead of using a local snapshot, so a free model Vercel adds later works without code changes.

Free models (priced `$0` for input and output) verified in the catalog:

| Model | Tool calling |
| --- | --- |
| `minimax/minimax-m3.1-flash` | yes |
| `nvidia/nemotron-3.5-lightning-free` | yes |
| `poolside/laguna-s-2.1-free` | yes |
| `reflection/beam-free` | yes |
| `stealth/glyph-cluster` | yes |
| `convaiinnovations/laya` | no |
| `convaiinnovations/laya-free` | no |

The agent's tools (`remember`, `forget`, `schedule`, `search_history`) require tool calling support: the two `laya` models do not expose it and cannot be used, and they are dropped automatically when the catalog loads.

`reflection/beam` also has a `$0` price in the catalog, but the price depends on the provider serving the request (`varies_by_provider`), so it is not guaranteed to be free: `bun run gateway:models` excludes it for that reason.

## Commands

| Command | What it does |
| --- | --- |
| `bun install` | Installs all workspaces. |
| `bun run setup` | Creates `.dev.vars` with the secrets and copies the token into `apps/mobile/.env.local`. |
| `bun run dev` | `setup`, then the server on Node and Expo together, with the LAN address already set. `--web` opens the browser. |
| `bun run dev:server` | Starts Wrangler locally on port 8787. |
| `bun run dev:server:lan` | Starts Wrangler on `0.0.0.0:8787` for the phone. |
| `bun run dev:mobile` | Starts Expo. |
| `bun run dev:web` | Starts the Expo web preview. |
| `bun run typecheck` | Typecheck of all packages. |
| `bun run test` | 274 tests: protocol, client, agent, the Worker gate, and the mobile pure functions. |
| `bun run check` | Typecheck + Worker dry-run. |
| `bun run check:server` | Only `wrangler deploy --dry-run --env=""`. Stays on the `mots` Worker. |
| `bun run check:server:staging` | Dry-run of `wrangler deploy --env staging`. Does not publish. |
| `bun run build:mobile` | Android export with Metro. |
| `bun run --cwd apps/server deploy` | Deploys the `mots` Worker (`wrangler deploy --env=""`). Not staging. |

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Health check. |
| `POST` | `/api/sessions` | Issues a signed code. Requires `Authorization: Bearer <MOTS_CREATE_TOKEN>`. Responds `201` with `{ sessionId, url, socketPath }`. `sessionId` is the full code. It does not create the Durable Object. |
| `GET` | `/api/sessions/:id` | WebSocket upgrade. `:id` must be the signed code. After verification, the Durable Object name is only the uuid. |

The application protocol lives in `packages/protocol`: client commands (`conversation.open`, `conversation.create`, `conversation.fork`, `prompt.submit`, `conversation.setModel`, `presence.typing`) and server events (snapshot, conversation events, inbox, presence, command results, errors).

## Agent tools

| Tool | Purpose |
| --- | --- |
| `remember` | Saves a durable fact or preference (max 100, deduplicated). |
| `forget` | Removes the memories that match a phrase. |
| `schedule` | Schedules an instruction in the future, with recurrence and timezone. |
| `search_history` | Searches past conversations through a subagent. |
| `fetch_page` | Reads the text of a public web page (http/https only, no private addresses, at most 512 KB read). |

The agent persona, the clock, and memory are injected as context sections. User messages may include `[Name]` to attribute the speaker.

## Status and next steps

- [x] Bun + TypeScript monorepo with workspaces.
- [x] Shared protocol, client SDK, and reducer.
- [x] Worker + Durable Object with SQLite, WebSockets, and alarms.
- [x] Agent with memory, reminders, and search. Default provider: Kilo. Environment alternatives: OpenRouter, Vercel AI Gateway, NVIDIA.
- [x] Mobile app with onboarding, chat, sessions, and fork.
- [x] Typecheck, Worker dry-run, Android bundle.
- [x] Automated suite (`bun run test`, 274 tests): protocol, client, agent, the Worker gate, and the mobile pure functions.
- [x] Local end-to-end check: health, session creation, WebSocket, and a new conversation.
- [x] Session gate: signed code, creation token, per-isolate rate limit, CORS from the environment, `conversation.setModel` allowlist, and caps on the number of routines and their cadence. These are not user accounts.
- [ ] Push notifications for reminders.
- [ ] Markdown, images, and voice messages.
- [ ] iOS build and a demo deploy.

To follow progress: this section, `git log --oneline`, and the verification commands above.

## Security and MVP limits

- Creating a session requires `MOTS_CREATE_TOKEN`. Opening a session requires the signed code made with `MOTS_SESSION_SECRET`. A bare uuid, or a tampered signature, responds `401` and does not create the Durable Object.
- The shared code is still how people get in: whoever has it can connect, without the creation token. Treat it as a secret.
- `MOTS_CREATE_TOKEN` inside a public binary can be extracted. It stops anonymous clients on the internet, not someone who unpacks the app. There are no user accounts yet.
- CORS: without `MOTS_CORS_ORIGINS`, or with `*`, every origin is allowed. An explicit list admits only those origins and answers `403` to the others. A request without `Origin` (native app, curl) passes.
- Rate limits are per Worker isolate, not global. The defaults are 8 creations every 10 minutes and 60 connections per minute, keyed by `CF-Connecting-IP` (locally, `local`). Behind a public hostname, an edge rate limit is needed as well.
- `conversation.setModel` only accepts a Mots provider whose model is in the registered catalog. The refusal is a `command.result` with `error.code` `model_not_allowed`.
- New routines cannot exceed `MOTS_MAX_SCHEDULES` (default 8) among unfinished delivery tasks, and a new recurrence cannot be more frequent than `MOTS_MIN_RECURRENCE_SECONDS` (default 15 minutes, never below 60 seconds). A one-shot stays at 1 second. An existing recurrence keeps running, even if it was at one-minute cadence: its successor is allowed while the source task is still open.
- The provider API key stays on the server.
- Data is not end-to-end encrypted: it lives in the Durable Object's storage.
- Mots is not a public service until both secrets are set, the app sends the bearer, and an edge rate limit covers the hostname.

## Mobile client adoption

The mobile app adopts this gate. `packages/client` does not take a new socket parameter. The contract is:

1. `POST /api/sessions` must send `Authorization: Bearer <MOTS_CREATE_TOKEN>`. Keep reading `sessionId` from the JSON body. That string is now the full join code (`{uuid}_{hmac}`, 80 characters, alphabet `[A-Za-z0-9_-]`). Store it unchanged. Do not strip the signature, lowercase it, or keep only the uuid.
2. The WebSocket URL stays `/api/sessions/${sessionId}`. `MotsClient` already builds that path. No query parameter and no second header on the socket.
3. Share and join the full `sessionId`. `parseJoinTarget` already accepts it. Joining does not send the create token.
4. A bare uuid saved by a current install is rejected with `401`. Send that person through onboarding again. Do not add a legacy bypass.
5. `conversation.setModel` can now fail with `command.result` `ok: false` and `error.code === "model_not_allowed"`. The protocol shape is unchanged. The reducer stores `event.error.message` on `state.error`, and the chat banner shows the refusal message in the app's language. The header pill stays on `snapshot.agent.model` until the server reports that model.
6. A schedule over the cap, or a new recurrence under the minimum cadence, fails inside the tool. No client frame changes.
7. Native apps send no `Origin`, so CORS does not affect them. A web preview must use an origin listed in `MOTS_CORS_ORIGINS` once that variable is set. Until it is set, every origin is allowed.
8. `429` bodies are `{ error: "rate_limited", message }` and include a `Retry-After` header in seconds. `401` is `{ error: "unauthorized", message }`. `503` means a server secret is missing (`session_secret_unconfigured` or `create_token_unconfigured`).
9. `EXPO_PUBLIC_MOTS_CREATE_TOKEN`, when set, is compiled into the app bundle. It is not a confidential secret. It only stops callers who do not have the app. When it is unset, `createSession` omits `Authorization`. This Worker still requires the bearer: a request without it is `401`, and a server without `MOTS_CREATE_TOKEN` is `503`.
10. The share sheet and the session menu show the entire `sessionId`. A sliced label is not a join code.

`apps/mobile/src/api.ts` `createSession` sends the bearer when `EXPO_PUBLIC_MOTS_CREATE_TOKEN` is set. A plain `GET` of the socket path distinguishes `426` (open the socket), `401` (offer a new space or a join), and `503` / `429` / `403` (the server is not ready). Any other result, including a network failure, still tries the socket. `apps/mobile/src/storage.ts` already accepts the new code shape.

## License

MIT. See [LICENSE](LICENSE).

Built by studying [pi-durable-cloudflare](https://github.com/earendil-works/pi-durable-cloudflare) and the [Pi](https://github.com/earendil-works/pi) packages.
