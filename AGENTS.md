# AGENTS.md

Operating guide for cloud agents working on Mots. The product README is in Italian and is the user-facing overview. This file is the source of truth for how to change the repo. The prioritized audit and the task list live in [docs/ANALYSIS.md](docs/ANALYSIS.md). Take one task from that list per pull request.

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

Live chat needs a provider key in `apps/server/.dev.vars` (gitignored). Copy `apps/server/.dev.vars.example`. `bun run check` and `bun run test` do not need a key.

| Variable | Required for |
| --- | --- |
| `MOTS_PROVIDER` | `kilo` (code default when unset), `openrouter`, `vercel-ai-gateway`, `nvidia` |
| `MOTS_MODEL` | Optional. Defaults per provider are in `packages/agent/src/provider.ts` (`DEFAULT_MODELS`). |
| `KILO_API_KEY` | Kilo. If unset, local dev may read `~/.pi/agent/auth.json` or send the literal key `free`. |
| `OPENROUTER_API_KEY` | OpenRouter |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway. The mobile sheet text says `AI_GATEWAY_TOKEN`; that name is wrong. |
| `NVIDIA_API_KEY` | NVIDIA |
| `EXPO_PUBLIC_MOTS_API_URL` | Optional build-time server URL baked into the app. Not a secret. |

Wrangler local dev reads `apps/server/.dev.vars`. A Cursor environment secret is not visible inside the Worker until it is copied into that file. Never commit `.dev.vars`, `~/.pi/agent/auth.json`, or a Cloudflare API token.

## Commands

Run from the repo root unless noted.

| Command | What it does |
| --- | --- |
| `bun install --frozen-lockfile` | Install workspace dependencies. |
| `bun run typecheck` | `tsc` in every workspace. |
| `bun run test` | Bun tests for protocol, client, agent, and mobile pure functions. |
| `bun run check:server` | `wrangler deploy --dry-run` for the Worker. |
| `bun run check` | Typecheck, then the Worker dry-run. This is the gate for a PR. |
| `bun run dev:server` | `wrangler dev` on port 8787. See the Wrangler gotcha below. |
| `bun run dev:server:lan` | Same, bound to `0.0.0.0`. |
| `bun run dev:mobile` | Expo. |
| `bun run dev:web` | Expo web preview. |
| `bun run build:mobile` | Android Metro export only. There is no iOS export script. |
| `bun run gateway:models` | Hits the public Vercel catalog. Needs network. Not part of CI. |

CI (`.github/workflows/ci.yml`) runs typecheck, test, and the Worker dry-run on Ubuntu with Node 22 and Bun 1.4.4.

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
- User-facing copy in the app is Italian. The agent preamble is English. Do not translate the product as a drive-by.
- `documentRetentionMs: 0` in the harness settings drops idle Pi documents from memory. It does not delete SQLite data. Leave it unless you are changing DO memory behavior on purpose.

## Gotchas

- The README still says the default provider is OpenRouter and that there are 19 tests. The code defaults to `kilo` / `reflection/beam-free` (`packages/agent/src/chat.ts`, `apps/server/src/session.ts`). `bun test` currently runs 70 tests. Trust the code, then fix the README in a docs task.
- Onboarding shows the server URL and never edits it. `setApiUrl` in `apps/mobile/src/screens/OnboardingScreen.tsx` is unused. Android defaults to `http://10.0.2.2:8787`, everything else to `http://localhost:8787`, unless `EXPO_PUBLIC_MOTS_API_URL` is set at bundle time.
- `ChatScreen` does not render `state.error`. A failed socket still looks like "connecting".
- The model pill is local React state. It does not read the model the Durable Object actually configured.
- Session ids are unauthenticated capabilities. The socket route accepts any `[A-Za-z0-9_-]{1,128}`, and `getByName` creates the Durable Object. Do not log session ids, prompts, or API keys.
- `readStoredKiloToken()` in `packages/agent/src/provider.ts` reads `~/.pi/agent/auth.json` when `KILO_API_KEY` is unset. On a laptop that uses the developer's personal token. Do not copy that file into the repo or the cloud VM.
- Recurring reminders do not reschedule themselves. After delivery, the model is asked to call `schedule` with `sourceScheduleId`. If it does not, the routine stops.
- `createMotsModels` fetches the Kilo and Vercel catalogs during Durable Object startup, with no timeout, even when the selected provider is OpenRouter or NVIDIA.
- `apps/mobile/gitignore` has no leading dot, so Expo's native-folder ignores are not active. The root `.gitignore` does not list `ios/` or `android/`.
- `mots_apple_trailer.mp4` at the repo root is about 6.7 MB. Flag it if relevant. Do not delete it unless the owner asks.
- Do not deploy (`wrangler deploy`) unless the task explicitly asks for a deploy. Dry-run is the default check.

## Secrets in Cursor cloud agent settings

Check and test need no secrets. A live Worker or a deploy does.

Set these as Cursor environment secrets, then have the agent write them into `apps/server/.dev.vars` (mode `600`, gitignored). Do not put the values in `environment.json`, the workflow, or a commit.

- `KILO_API_KEY` (optional; Kilo can fall back to a free tier)
- `OPENROUTER_API_KEY`
- `AI_GATEWAY_API_KEY`
- `NVIDIA_API_KEY`
- `MOTS_PROVIDER` and `MOTS_MODEL` if you want a non-default pair
- `CLOUDFLARE_API_TOKEN` only if the agent is supposed to deploy. Scope it to this Worker. Prefer not to until auth and rate limits exist.

`EXPO_PUBLIC_MOTS_API_URL` is public. Set it in the environment if the web preview should target a tunnel or a deployed Worker. It is inlined into the client bundle.

The dashboard environment for this repo is separate from the committed `.cursor/environment.json`. Saving the environment in Cursor is what makes the install script run for agents on the current environment. See the setup section of the pull request that added this file.
