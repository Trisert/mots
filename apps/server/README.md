# Mots server

The server is a Cloudflare Worker (`src/index.ts`, `src/router.ts`) that routes requests to one Durable Object class, `Session`. Each Session is one conversation space: it owns a SQLite database, holds its WebSockets through the hibernation API, schedules routines with alarms, and runs the agent through the Pi Durable harness from `@mots/agent`.

## Routes

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/api/health` | Health check. |
| `POST` | `/api/sessions` | Requires `Authorization: Bearer <MOTS_CREATE_TOKEN>`. Returns `201` with a signed join code. It does not create the Durable Object. |
| `GET` | `/api/sessions/:code/models` | Lists the models this session can select. |
| `GET` | `/api/sessions/:code` | WebSocket upgrade. The code is verified before any Durable Object is addressed. |

The Durable Object name is the uuid inside the code, never the full code. The signature is checked in the Worker first (`src/session-auth.ts`), so a bare uuid or an altered signature gets `401`.

## Layout

```
src/index.ts          Worker entry point; the Session class is exported from here
src/router.ts         route matching, CORS, rate limits, auth gate
src/session.ts        the Session Durable Object: commands, storage, alarms, agent turns
src/session-auth.ts   HMAC join codes
src/cors.ts           CORS allowlist from MOTS_CORS_ORIGINS
src/rate-limit.ts     per-isolate rate limits
src/identity.ts       normalization of the username shown in [Name] attributions
src/serial.ts         KeyedSerialQueue: serializes async work per key
test/                 router, session auth and a fake-LLM smoke test of the Worker
```

Idempotency for `conversation.create` and `conversation.fork` comes from a receipt document keyed by `requestId`, in `session.ts`. Keep it when you change those commands.

## Configuration

Secrets are read from `.dev.vars` locally and from `wrangler secret put` in production. The full table is in the root [README](../../README.md#configurazione). The required values are `MOTS_SESSION_SECRET` and `MOTS_CREATE_TOKEN`, each at least 16 characters. Without them the Worker answers `503`.

`MOTS_PROVIDER` selects the LLM provider: `kilo` (the default when unset), `openrouter`, `vercel-ai-gateway` or `nvidia`. An unknown value fails session startup on purpose.

## Run locally

Wrangler must run on Node 22 or later, not under Bun:

```bash
cd apps/server
node ./node_modules/wrangler/bin/wrangler.js dev        # port 8787
```

From the repository root, `bun run dev:server` does the same thing from the workspace script. `bun run dev:server:lan` binds to `0.0.0.0` so a phone on the same network can reach it.

If `GET /api/health` returns `503`, the runtime is wrong, not the code: check that `node --version` reports 22 or later and that Node comes before Bun on the `PATH`.

## Check and test

```bash
bun run typecheck            # tsc in every workspace
bun run check:server         # wrangler deploy --dry-run for the mots Worker
bun run check:server:staging # the same for mots-staging
bun test apps/server/test    # Worker tests
```

A dry-run does not execute a request. To check a live session, start Wrangler and call the routes. Don't claim a live session works from a dry-run alone.

## Deploy

Deployment is manual and only when you mean it:

```bash
cd apps/server
bunx wrangler secret put MOTS_SESSION_SECRET --env=""
bunx wrangler secret put MOTS_CREATE_TOKEN --env=""
bunx wrangler deploy --env=""           # the mots Worker
bunx wrangler deploy --env staging      # the mots-staging Worker
```

`--env=""` selects the top-level Worker. Without the flag, Wrangler also considers the staging environment. Bindings are not inherited between environments, so `wrangler.jsonc` repeats the `SESSIONS` Durable Object binding for staging. Keep it that way, or staging will use a different object class.

Do not deploy a Worker that the mobile app cannot authenticate against: a client without the create-token bearer receives `401`.

## Notes

- The Durable Object's `documentRetentionMs: 0` setting drops idle Pi documents from memory. SQLite data stays.
- Recurring routines do not reschedule themselves. After a delivery, the agent must call `schedule` with `sourceScheduleId`, or the routine stops.
- Rate limits live in each Worker isolate and key on `CF-Connecting-IP`. They are not a global limit.
