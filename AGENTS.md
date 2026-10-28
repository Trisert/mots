# AGENTS.md

Operating guide for cloud agents working on Mots. The product README is the user-facing overview. This file is the source of truth for how to change the repo. The prioritized audit and the task list live in [docs/ANALYSIS.md](docs/ANALYSIS.md). Which tasks are done, and the product plan, are in [docs/ROADMAP.md](docs/ROADMAP.md). Take one task per pull request.

## What this repo is

Bun + TypeScript monorepo. A mobile Expo app talks over WebSocket to a Cloudflare Worker. Each session is one Durable Object (`Session`) with SQLite, hibernating WebSockets, and alarms. The agent runs inside that object on [Pi Durable](https://github.com/earendil-works/pi).

```
apps/mobile     Expo / React Native UI
apps/server     Worker router + Session Durable Object
packages/protocol   Wire types and parsers (no I/O)
packages/client     MotsClient, reducer, command outbox
packages/agent      Harness options, LLM providers, memory, schedule, search
```

Do not change app behavior while doing docs, CI, or environment work. Do not remove `mots_apple_trailer.mp4` or `trailer.html`. Do not commit secrets.

## Setup

Requirements that are already encoded in `.cursor/environment.json`:

- Node.js 22 or newer, on `PATH` as `node`.
- Bun 1.4.4, linked at `/usr/local/bin/bun` so login shells find it. The installer also drops a copy in `~/.bun/bin`; do not rely on `~/.bashrc`.
- `bun install --frozen-lockfile` from the repo root. There is a `bun.lock`. Do not switch the repo to npm or pnpm, and do not refresh the lockfile unless the task is a dependency change.

Live chat needs `apps/server/.dev.vars` (gitignored). `bun run setup` creates it from `apps/server/.dev.vars.example` with fresh secrets; add a provider key by hand if the default Kilo free tier is not enough. `bun run check` and `bun run test` do not need a key.

| Variable | Required for |
| --- | --- |
| `MOTS_SESSION_SECRET` | HMAC key for join codes. At least 16 characters. `POST /api/sessions` and the socket both return `503` when it is missing. Rotating it invalidates every code. |
| `MOTS_CREATE_TOKEN` | Bearer for `POST /api/sessions`. At least 16 characters. Missing or wrong is `503` / `401`. A copy inside the app binary is extractable. |
| `MOTS_CORS_ORIGINS` | Optional comma-separated browser origins. Unset or `*` allows every origin. Native apps send no `Origin`. |
| `MOTS_PROVIDER` | `kilo` (code default when unset), `openrouter`, `vercel-ai-gateway`, `nvidia`. Any other value fails session startup. |
| `MOTS_MODEL` | Optional. Defaults per provider are in `packages/agent/src/provider.ts` (`DEFAULT_MODELS`). `conversation.setModel` can only select a model the catalog actually contains. |
| `MOTS_CREATE_LIMIT`, `MOTS_CREATE_WINDOW_SECONDS` | Optional. Default 8 creates per 10 minutes per address. Invalid values keep the default. |
| `MOTS_CONNECT_LIMIT`, `MOTS_CONNECT_WINDOW_SECONDS` | Optional. Default 60 connects per minute per address. |
| `MOTS_MAX_SCHEDULES` | Optional. Default 8 non-terminal delivery tasks. Range 1–100. |
| `MOTS_MIN_RECURRENCE_SECONDS` | Optional. Default 900. Values below 60 are ignored. One-shots stay at 1 second. |
| `KILO_API_KEY` | Kilo. If unset, local dev may read `~/.pi/agent/auth.json` or send the literal key `free`. |
| `OPENROUTER_API_KEY` | OpenRouter |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway. The mobile sheet uses this name and `ai-gateway.vercel.sh/v1`. |
| `NVIDIA_API_KEY` | NVIDIA |
| `TAVILY_API_KEY` | Optional. Makes `web_search` use Tavily. Without it, `web_search` uses Exa and Parallel in rotation; neither needs a key. |
| `EXPO_PUBLIC_MOTS_API_URL` | Optional build-time server URL baked into the app. Not a secret. |
| `EXPO_PUBLIC_MOTS_CREATE_TOKEN` | Optional app-wide gate, not a per-user secret. Inlined into the bundle. Sent as `Authorization: Bearer` on `POST /api/sessions` when set. Omitted when unset, so a local Worker without the check still creates a session. |

Wrangler local dev reads `apps/server/.dev.vars`. A Cursor environment secret is not visible inside the Worker until it is copied into that file. Never commit `.dev.vars`, `~/.pi/agent/auth.json`, or a Cloudflare API token.

## Commands

Run from the repo root unless noted.

| Command | What it does |
| --- | --- |
| `bun install --frozen-lockfile` | Install workspace dependencies. |
| `bun run typecheck` | `tsc` in every workspace. |
| `bun run test` | Bun tests for protocol, client, agent, the Worker gate, and mobile pure functions. The suite is 353 tests. |
| `bun run check:server` | `wrangler deploy --dry-run --env=""` for the top-level Worker `mots`. |
| `bun run check:server:staging` | `wrangler deploy --dry-run --env staging` for `mots-staging`. Does not publish. |
| `bun run check` | Typecheck, then the top-level Worker dry-run. This is the gate for a PR. |
| `bun run setup` | Creates `apps/server/.dev.vars` from the example, fills empty or short `MOTS_SESSION_SECRET` / `MOTS_CREATE_TOKEN` with random values (keeps working ones), and writes the create token to `apps/mobile/.env.local`. Never prints secrets. |
| `bun run dev` | `setup`, then Wrangler under Node on `0.0.0.0:8787`, then Expo with `EXPO_PUBLIC_MOTS_API_URL` set to the LAN address. `--web` starts the web preview. Ctrl+C stops both. |
| `bun run dev:server` | `wrangler dev` on port 8787. See the Wrangler gotcha below. |
| `bun run dev:server:lan` | Same, bound to `0.0.0.0`. |
| `bun run dev:mobile` | Expo. |
| `bun run dev:web` | Expo web preview. |
| `bun run build:mobile` | Android Metro export only. There is no iOS export script. |
| `bun run gateway:models` | Hits the public Vercel catalog. Needs network. Not part of CI. |

CI (`.github/workflows/ci.yml`) runs typecheck, test, the top-level Worker dry-run, and `bun run check:server:staging` on Ubuntu with Node 22 and Bun 1.4.4. It does not deploy.

## How to verify a change

1. `bun run check`
2. `bun run test`
3. If you touched a package, run that package's tests directly too, for a tighter signal: `bun test packages/<name>` or `bun test apps/mobile/test`.
4. If you touched the Worker route or the Durable Object, also run `bun run check:server`. A dry-run does not execute a request. There is no DO test harness yet; do not claim a live session works unless you started Wrangler and exercised it.
5. If you changed mobile UI, run the app (`bun run dev:web` against a local Worker) and use the flow a person would use. A screenshot of a static render is not verification.

There is no ESLint and no Prettier. Match the surrounding style: strict TypeScript, `verbatimModuleSyntax`, explicit `.ts` import suffixes in the packages that already use them, no `any` added to get past the compiler.

## Wrangler needs Node, not Bun

`wrangler dev` returns HTTP 503 when the Bun runtime launches it. `wrangler deploy --dry-run` currently succeeds under `bun run`, but the dev server does not.

If `GET http://localhost:8787/api/health` is 503:

```bash
cd apps/server
node ./node_modules/wrangler/bin/wrangler.js dev
```

The bin file's shebang is `#!/usr/bin/env node`. `node` must resolve to Node 22+, not a Bun shim. `apps/server` declares `"engines": { "node": ">=22" }`.

Do not "fix" a 503 by editing Worker code. Fix the runtime first.

## Conventions

- Workspace packages are `@mots/protocol`, `@mots/client`, `@mots/agent`, `@mots/server`, `@mots/mobile`. Depend inward: mobile and server use the packages; protocol does not import the others.
- Protocol parsers throw `InvalidClientCommand` for bad client frames and `Error` for bad server frames. Keep validation at the boundary in `packages/protocol`. Do not trust a frame just because TypeScript says it is a `ClientCommand`.
- Durable Object storage and the Pi harness are the source of truth. The mobile app is a projection. Idempotency for create and fork is the receipt doc keyed by `requestId` in `apps/server/src/session.ts`. Preserve that when you change commands.
- Tool handlers that are marked `replay: "safe"` must stay safe to run twice. Schedule creation is guarded by the `app.schedule-intent` doc. Do not create a second task on replay.
- The app's look comes from the Mots design system (https://claude.ai/artifact/HWoqJFg45sk4wqpKVKuMSW): tokens in `apps/mobile/src/palette.ts` and `theme.ts`, Figtree plus JetBrains Mono, pastels as fills with `inkOnPastel` text only, and the speech-bubble `Mascot` (`apps/mobile/src/components/Mascot.tsx`), which holds still under reduced motion. Change a value there and in the design system together.
- All repository content is English: docs, README, code comments, log and error messages, PR and issue text. The agent preamble is English.
- App copy goes through `apps/mobile/src/i18n`. Add a key to `en` in `messages.ts` and its Italian translation to `it`; the `it` record is typed against `en`, so a missing translation fails typecheck. Components read copy with `useI18n()`; pure modules take a `Translate` argument (`englishTranslate` in tests). Do not hardcode user-facing strings. English is the default; the language is picked in Settings, and the first run follows the device language.
- The app language is sent as `session.setLocale` (like the timezone) and stored in `LocaleDoc`. The agent preamble replies in that language, and routine push texts use it too. Without a stored locale the agent follows the user's language. Add a language to `SESSION_LOCALES` and to `PUSH_COPY` in `packages/agent/src/locale.ts`.
- `documentRetentionMs: 0` in the harness settings drops idle Pi documents from memory. It does not delete SQLite data. Leave it unless you are changing DO memory behavior on purpose.

## Gotchas

- The code defaults to `kilo` / `reflection/beam-free` (`packages/agent/src/provider.ts`, `DEFAULT_MODELS`). An unknown `MOTS_PROVIDER` fails session startup.
- Onboarding edits the server URL and saves it with the identity. Android still defaults to `http://10.0.2.2:8787`, everything else to `http://localhost:8787`, unless `EXPO_PUBLIC_MOTS_API_URL` is set at bundle time.
- `ChatScreen` renders `state.error`. `failed` and `connecting` use different copy. Riprova after a terminal close builds a new `MotsClient`, because `connect()` ignores calls once the client has given up.
- The model picker (`apps/mobile/src/components/ModelPicker.tsx`) loads `GET /api/sessions/:code/models`. The list and the `conversation.setModel` check share one policy, `modelPolicy` in `packages/agent/src/model-catalog.ts`: the selected provider, Kilo (free models only without `KILO_API_KEY`), and every provider whose key is set. Batch and `~…-latest` ids are hidden. There is no model list in the app; do not add one back.
- The header title opens the picker and reads `snapshot.agent.model`. It does not change until the server reports the new model. A `model_not_allowed` refusal shows inside the picker.
- The socket path still matches `[A-Za-z0-9_-]{1,128}`, but `getByName` runs only after `verifySessionCapability`. The Durable Object name is the uuid, never the full join code. `POST /api/sessions` does not create a Durable Object. The app stores and shares the full join code. Do not log session ids, prompts, or API keys.
- Do not re-open a legacy uuid bypass. A stored bare uuid probes as `401` and the chat offers a new space or a join. The mobile adoption steps are in the README section "Mobile client adoption".
- Rate limits in `apps/server/src/rate-limit.ts` are per Worker isolate. They use `CF-Connecting-IP` only. Do not add a second Durable Object class for them without a migration plan.
- `readStoredKiloToken()` in `packages/agent/src/provider.ts` reads `~/.pi/agent/auth.json` when `KILO_API_KEY` is unset. On a laptop that uses the developer's personal token. Do not copy that file into the repo or the cloud VM.
- Recurring reminders reschedule themselves. `DeliverScheduledInstruction` writes the next run in the same commit that clears the active delivery (`commitDeliveryOutcome`), whether the turn succeeded or failed. A routine stops after `MAX_CONSECUTIVE_FAILURES` (3) failed runs in a row, and the user gets a push. An abort or a missing conversation also stops it. The model is told not to repeat the routine. A `schedule` call with `sourceScheduleId` still works and wins over the system's row.
- `createMotsModels` fetches the live Kilo catalog only for Kilo sessions; other sessions use `KILO_FALLBACK_MODELS`. It fetches the Vercel catalog only when Vercel is selected or `AI_GATEWAY_API_KEY` is set. Live catalogs load in parallel, use per-isolate caches, and abort after `CATALOG_TIMEOUT_MS` (4 seconds).
- `mots_apple_trailer.mp4` at the repo root is about 6.7 MB. Flag it if relevant. Do not delete it unless the owner asks.
- Do not deploy (`wrangler deploy`) unless the task explicitly asks for a deploy. Dry-run is the default check.

## Secrets in Cursor cloud agent settings

Check and test need no secrets. A live Worker or a deploy does.

Set these as Cursor environment secrets, then have the agent write them into `apps/server/.dev.vars` (mode `600`, gitignored). Do not put the values in `environment.json`, the workflow, or a commit.

- `MOTS_SESSION_SECRET` and `MOTS_CREATE_TOKEN` before any live session. Generate each with `openssl rand -base64 32`. Do not commit them and do not reuse a placeholder.
- `KILO_API_KEY` (optional; Kilo can fall back to a free tier)
- `OPENROUTER_API_KEY`
- `AI_GATEWAY_API_KEY`
- `NVIDIA_API_KEY`
- `TAVILY_API_KEY` (optional; makes `web_search` use Tavily)
- `MOTS_PROVIDER` and `MOTS_MODEL` if you want a non-default pair
- `MOTS_CORS_ORIGINS` before a public web client
- `CLOUDFLARE_API_TOKEN` only if the agent is supposed to deploy. Scope it to this Worker. Do not deploy until the mobile app sends the create-token bearer.

`EXPO_PUBLIC_MOTS_API_URL` is public. Set it in the environment if the web preview should target a tunnel or a deployed Worker. It is inlined into the client bundle. `EXPO_PUBLIC_MOTS_CREATE_TOKEN` would also be inlined. It is an app-wide gate, not a per-user secret.

The dashboard environment for this repo is separate from the committed `.cursor/environment.json`. Saving the environment in Cursor is what makes the install script run for agents on the current environment. See the setup section of the pull request that added this file.
