# Mots roadmap

Date: 2026-10-26. This file is the product plan. [ANALYSIS.md](ANALYSIS.md) is the engineering audit and the M-task list; the status table below says which of those tasks are done. Read [AGENTS.md](../AGENTS.md) before changing code.

## Where Mots stands

Mots is a pocket companion: one session is a Cloudflare Durable Object running a Pi Durable harness, with durable memory, scheduled routines that wake the object through alarms, history search through a subagent, and an Expo app over WebSocket. Sessions are opened by a signed join code. There are no user accounts.

### M-task status

| Task | State | Where |
| --- | --- | --- |
| M1 Fail closed on provider config | Done | `resolveMotsProvider` |
| M2 Allowlist `conversation.setModel` | Done | `packages/agent/src/allowlist.ts` |
| M3 Schedule quotas and recurrence tests | Done | `packages/agent/src/schedule-limits.ts` |
| M4 Issued session ids | Done, as HMAC join codes instead of a stored list | `apps/server/src/session-auth.ts` |
| M5 CORS allowlist and rate limit | Done (per isolate) | `apps/server/src/cors.ts`, `rate-limit.ts` |
| M6 Local Kilo auth file gated | Done | `packages/agent/src/provider.ts` |
| M7 Durable recurrence | Done | `packages/agent/src/schedule.ts` |
| M8 Docs match code | Done | README |
| M9 Server URL field | Done | onboarding |
| M10 Visible errors and retry | Done | `ChatScreen` |
| M11 Startup catalogs with timeout | Done | `provider.ts` |
| M12 Outbox while disconnected | Done 2026-10-26 | `packages/client/src/command-outbox.ts` |
| M13 Push token protocol | Done | `pushToken.*` |
| M14 Push on delivery | Done | `packages/agent/src/push-token.ts` |
| **M15 Mobile push registration** | **Open** | needs `expo-notifications` and a dev build |
| M16 Markdown links | Done | `apps/mobile/src/markdown.ts` |
| **M17 Image messages** | **Open** | |
| **M18 Voice messages** | **Open** | |
| M19 EAS and iOS | Done (preview profile) | `apps/mobile/eas.json` |
| M20 Staging Worker | Done | `wrangler.jsonc` `staging` |
| M21 Search scan budget | Done | `packages/agent/src/search.ts` |
| **M22 ESLint** | **Open** | |
| M23 Fake-LLM Worker smoke | Done | `apps/server/test/fake-llm.test.ts` |
| M24 Italian copy out of the client | Done 2026-10-26 | `RunErrorCode`, `apps/mobile/src/present.ts` |
| **M25 Trailer to LFS or release** | **Owner decision** | do not delete |

Also landed on 2026-10-26, outside the M list:

- **Session timezone.** The app sends `session.setTimezone` after every snapshot. The `app.timezone` doc feeds the clock section, so "at 9" means 9 local time. Without a stored zone the model still works in UTC.
- **Model picker from the server.** `GET /api/sessions/:code/models` lists only models the session can switch to, with free, image, reasoning and context badges; the app no longer ships a hard-coded list. Keys stay on the server.
- **Mots design system in the app.** Pastel, rounded tokens, Figtree, and the animated speech-bubble mascot on onboarding, the empty chat, the thinking state and beside replies. The bottom tab bar from the mockups waits for Routine and Memoria data on the client.
- **`fetch_page` tool.** Read-only: reads a public http(s) page and returns its title and text. Private, local and non-default-port addresses are refused, and redirects are checked hop by hop.
- **`web_search` tool.** Tavily. `TAVILY_API_KEY` is optional and raises the limits; without it Tavily's keyless mode answers. Returns up to five results, each with a title, URL and a snippet of at most 600 characters. Result addresses pass the same checks as `fetch_page`.
- **Safe `forget`.** Exact match first; one substring match only for queries of 3+ characters; otherwise nothing is removed and candidates are listed. `remember` reports facts dropped at the 100-fact cap.

## Competitive landscape (October 2026)

Four "always-on" agents define the category. Sources are mostly secondary coverage and disagree on prices; check before quoting them.

| Product | Shape | Notable |
| --- | --- | --- |
| Grok Bot (xAI, Aug) | Several role-based bots for a team | Bundled with SuperGrok and Cursor. Reported: bots share one computer, not a security boundary. |
| Meta Muse (Sep) | Consumer agent, free tier | Own VM with browser; WhatsApp first; email and calendar; editable visible memory ("soul" files). Privacy criticism. |
| OpenAI dots (Sep) | Agent inside ChatGPT | Own cloud computer; plugins; scheduled jobs; Slack, Teams, SMS, voice. Proactive research is read-only until an action passes permission checks. |
| Claude Duet (Oct 21) | Professional agent, research preview | Opus 5.5; 6,000+ connectors; morning briefing; own VM with browser; asks before sending, paying, signing, deleting; trading and transfers hard-blocked. |

Table stakes: background work, connectors (mail, calendar), persistent memory, proactivity, approvals for sensitive actions.

Mots already has durable routines, memory, history search, and a very low cost per idle user (a hibernating Durable Object). It lacks connectors, tools that act on the world, channels beyond the app, proactivity, and approvals.

Positioning: a light, private, European companion; open source; user's choice of model; near-zero idle cost. Do not try to rent a VM per user.

## Phases

One task per pull request, as `AGENTS.md` asks. Branch from current `main`, run `bun run check` and `bun run test`.

### Phase 0. Make the current promise true

- [x] Session timezone
- [x] Safe `forget`
- [x] M12 offline outbox
- [x] M24 run error code
- [ ] **M15** mobile push registration (`expo-notifications`, register on connect with `pushToken.register`). Needs a dev build; say which platform was verified.
- [ ] Timezone follow-up: show the stored zone in the session sheet and let the user override it.

### Phase 1. Accounts and transparent memory

- Accounts (passkey, Sign in with Apple or Google). A `User` Durable Object owns personal memory and per-user spend. Sessions stay as shared spaces. Replace the AsyncStorage identity, do not add a second secret next to it.
- Daily spend cap per user and per session, enforced before each model turn and each scheduled delivery.
- "Cosa so di te" screen: list, edit, delete facts; export. Structured facts (kind, source, date) and retrieval of relevant facts instead of injecting all of them every turn.

### Phase 2. Act on the world

- [x] `web_search` (Tavily, optional `TAVILY_API_KEY`) and `fetch_page` tools. No VM.
- Connectors over MCP, read-only first: Google Calendar, then Gmail. OAuth tokens encrypted in the `User` object.
- **Approvals.** A durable `AwaitApproval` task that blocks until the user answers a push with Approva / Rifiuta, and a protocol event for it. Every write tool goes through it.
- **Cua Spaces** as the "computer" (see below).

### Phase 3. Proactivity and channels

- Default morning briefing routine (agenda, reminders, topics from memory).
- Quiet periodic checks that only message when something changed.
- Telegram bot channel (a Worker); WhatsApp Business later. The protocol is platform-agnostic, so a channel is another client.
- M17 images, M18 voice, several specialised assistants per session.

Suggested order: Phase 0, accounts and spend cap, web tools, approvals with the Calendar connector, briefing, Cua Spaces.

## Cua Spaces integration design

[Cua Spaces](https://github.com/trycua/cua) (v0.11.0, 2026-10-20) gives agents full desktops ("Spaces") on the user's Mac, their other machines, or their own AWS / GCP / Modal account. Facts below come from the `trycua/cua` source; cua.ai docs were not reachable when this was written.

What matters for Mots:

- Each Space runs `cua-spacesd` on port 3211. It serves **`POST /mcp`** (streamable HTTP MCP over the Cua Driver tools), authenticated by the Space's root token (`authorization: Bearer` or `x-cua-env-authorization: Bearer`). `cua mcp` / `cua daemon mcp` are stdio and local only; a Worker cannot use them.
- Tool groups: `computer:screenshot|click|type|key|scroll|drag|hotkey|clipboard|file|shell|window|accessibility`, `spaces:*`, `sandbox:*`. Grant the minimum.
- Reachability: `relay.cua.ai` (or a self-hosted `cua-relay`) splices clients to machines without open ports. The relay README names Cloudflare-hosted agents as users of its HTTPS path, where **the relay sees plaintext** in flight (Keyvault and Teleport payloads are sealed). Account mode needs an enrolled device with a P-256 key and an interactive sign-in, which does not fit a server; static mode presents the Space token end to end.
- Licence: Cua Driver and the root repo are MIT. `cua-spacesd` and the Spaces apps are **FSL-1.1-MIT** (no competing use; each release becomes MIT after two years). Driving the user's own Spaces as a client is fine. Hosting `cua-spacesd` as "Mots computers" needs a licence review first.

Proposed shape:

```
App ──WS──▶ Worker ──▶ Session DO (Pi Durable)
                         │ tool use_computer(task)
                         │   └─ child conversation (vision model)
                         │        computer_* tools ──HTTP MCP──▶ relay or Cloudflare Tunnel ──▶ cua-spacesd /mcp
                         │ AwaitApproval task ──push──▶ phone
                         └─ doc app.spaces { address, encrypted token }
```

1. **Link.** `space.link { address, token }` validated in `packages/protocol`. Token encrypted with a key derived from a new Worker secret (`MOTS_SPACES_KEY`), never echoed to clients or logs. Transport: a self-hosted static relay, or Cloudflare Tunnel (`cloudflared` to `localhost:3211`) with an Access service token so no third party sees plaintext.
2. **MCP client.** `packages/agent/src/spaces.ts`: `initialize`, `tools/list`, `tools/call` over HTTP with `AbortSignal.timeout`. Pi has no MCP, so wrap a curated set of tools as Pi tools. Check `GetCapabilities` / protocol version; Cua moves fast.
3. **`use_computer(task)`.** Same pattern as `search_history`: a child conversation runs the screenshot → action loop and returns a summary, so screenshots stay out of the main context. It must pick a model whose `input` includes `image` and refuse clearly otherwise.
4. **Replay.** Computer actions are not safe to run twice. Keep a durable action log per tool task (like `app.schedule-intent`) so a resumed task skips steps it already performed.
5. **Approvals.** `computer:shell`, `computer:file`, `spaces:teleport_app`, and anything that sends, pays, or deletes always ask; `computer:readonly` never asks. Step and cost caps per task.
6. **App.** "Collega il tuo computer" settings with the `cloudflared` command; latest screenshot and steps in the chat. Live view (WebCodecs media stream) is a later PR.

Prerequisites: accounts and the spend cap. A token that opens a shell on someone's computer must not live in a session that anyone with the join code can open.

PR sequence: (1) MCP client + read-only `use_computer` with a stubbed `/mcp` in tests; (2) `AwaitApproval` + push; (3) write actions behind approval with the action log; (4) `space.link` and app UI; (5) live view.
