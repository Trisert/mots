# Mots analysis

> Status as of 2026-10-26: most M-tasks below are done. The live status table is in [ROADMAP.md](ROADMAP.md#m-task-status). This audit is kept as the record of why each task exists.

Date: 2026-10-24. Scope: the whole monorepo as of `main` plus this setup PR. Method: read the Worker, Durable Object, protocol, client, agent, and mobile app; checked Pi Durable 1.2.0 types for `inspect` and `documentRetentionMs`; ran `bun run typecheck`, `bun run test`, and `wrangler deploy --dry-run`. No application behavior was changed.

This is an MVP of a mobile AI companion: one session is a Durable Object, the model has memory, reminders, and history search, and the phone is a WebSocket client. The split between protocol, client, agent, and Worker is the right shape. It is not ready to put on the public internet. The README already says so. The gaps below are ordered so a later agent can pick one task, merge it, and leave the tree greener.

## Ranked improvements

Impact is what changes for a person using Mots or for the Cloudflare bill. Effort is the size of one reviewable pull request, assuming the agent does not boil the ocean.

| Rank | Improvement | Impact | Effort | Why it is here |
| --- | --- | --- | --- | --- |
| 1 | Stop unauthenticated Durable Object creation and unbounded LLM spend | High | Medium | Anyone who can reach the Worker can open a session and burn provider credits. Required before a public URL. |
| 2 | Make recurrence durable in code | High | Medium | A reminder repeats only if the model calls `schedule` again. That is the product's main promise. |
| 3 | Cap schedules and validate `conversation.setModel` | High | Small | A leaked session id, or a prompt injection, can set an expensive model and a one-minute cron. |
| 4 | Show failures and let the user set the server URL | High | Small | The app hides command errors, treats a dead socket as "connecting", and cannot point at a LAN or deployed host from the UI. |
| 5 | Don't block object startup on unused model catalogs | High | Small | Every new session waits on Kilo and Vercel HTTP calls with no timeout, inside `blockConcurrencyWhile`. |
| 6 | Push notification when a reminder fires | High | Large | The alarm runs the model in the Durable Object. The phone learns about it only if the app is open. Depends on a real iOS/Android build. |
| 7 | Server and schedule tests, then a fake-LLM end-to-end | Medium | Medium | 70 unit tests pass. Nothing boots a Worker. `nextRecurrenceRunAt` has no tests. |
| 8 | Sync README, provider metadata, and the model pill with the code | Medium | Small | Docs and the model picker disagree with `DEFAULT_MODELS` and with the Worker env. |
| 9 | History search that does not scan every entry | Medium | Medium | Search is a substring walk plus a second model call. Fine for a demo, costly after real use. |
| 10 | iOS build and a deliberate public deploy | Medium | Large | Android export exists. There is no EAS config, no iOS export, no staging Worker. Do this after 1–3. |

CI, `AGENTS.md`, and `.cursor/environment.json` landed in the same PR as this document. They are the floor for the tasks below, not a substitute for them.

## What is already in good shape

- Package boundaries are real. `packages/protocol` parses frames and does not do I/O. `packages/client` reduces server events into a store that matches `useSyncExternalStore`. The Worker is a router. The Durable Object owns the harness.
- Create and fork are idempotent. `ConversationCommandReceipts` stores the result under the client `requestId`, so a replay does not fork twice (`apps/server/src/session.ts`).
- Schedule creation is replay-safe via the task-scoped `app.schedule-intent` doc (`packages/agent/src/tools.ts`).
- WebSocket frames are size-limited (`MAX_CLIENT_FRAME_CHARACTERS`). Binary frames and invalid JSON close the socket. Per-socket work is serialized with `KeyedSerialQueue`.
- Hibernated sockets restore conversation watches from the attachment (`#restoreEventStreams`). Legacy PartyServer attachments are still accepted.
- Username input is normalized: NFKC, control characters and brackets stripped, 40 characters (`apps/server/src/identity.ts`).
- Provider keys are read from the Worker env and are not part of the client protocol. `.dev.vars` is gitignored. The example file has empty values.
- `documentRetentionMs: 0` is a memory policy. Pi's types say `0` drops an unobserved document from RAM after use and reloads it from storage. It does not delete facts.
- `Harness.inspect` is documented as live unfinished work. The 60-second recovery alarm does not walk historical terminal tasks.
- Tool-capable gateway models are mapped carefully (max tokens field, no `store`, no invented reasoning effort). Those mappings have tests.
- The mobile chat list sticks to the bottom, has a composer, forks, and renders a small markdown subset. That is more UI than the README roadmap admits.

## Architecture

```
Expo app (@mots/mobile)
  AsyncStorage identity (sessionId, username, apiUrl)
  MotsClient WebSocket
        |
        |  POST /api/sessions          -> { sessionId }   (no Durable Object yet)
        |  GET  /api/sessions/:id      -> WebSocket upgrade
        v
Worker (@mots/server)
  CORS *, no auth, no rate limit
  env.SESSIONS.getByName(id)           -> creates the object on first contact
        |
        v
Session Durable Object (SQLite)
  Pi Durable Harness
    @mots/agent tools: remember, forget, schedule, search_history
    alarm wakes blocked work and scheduled deliveries
```

A session id is the only capability. The Worker does not remember which ids it minted. `POST /api/sessions` returns `crypto.randomUUID()`, but the upgrade route accepts any `[A-Za-z0-9_-]{1,128}` and `getByName` creates the object. A client can invent an id and skip `POST`.

Sharing a session is a product feature (join code, share sheet). Auth work has to keep intentional sharing and still stop strangers from creating objects and spending the API key.

Data lives in the Durable Object's SQLite. It is not end-to-end encrypted. Memory is a session document (`mots.memory`), not a per-user account. Two people in one session share one memory and one provider bill.

## Security

Already admitted in the README, confirmed in code:

- No authentication. `apps/server/src/index.ts` has no check before `getByName`.
- CORS is `Access-Control-Allow-Origin: *` for every response, including errors.
- No rate limit, no body quota beyond the WebSocket frame cap, no per-session spend cap.
- The session id in the URL and in AsyncStorage is the secret. The share sheet pastes it into the OS share dialog.

Additional issues the README does not spell out:

1. **Client-chosen object names.** The route is not "only ids this Worker issued". Guessing a UUID is impractical. Choosing a short name, or opening many names, is trivial and creates SQLite-backed objects.
2. **`conversation.setModel` is unchecked.** `apps/server/src/session.ts` writes `command.provider` and `command.modelId` through `configure` with no allowlist. The protocol only checks that they are non-empty strings. A holder of the session id can point the conversation at any provider string the harness will accept. The mobile sheet also offers non-free models (Claude, GPT-4o mini, and others) that the server may actually call.
3. **No schedule quota.** `schedule` accepts a 1-minute cadence (`minimum: 1` on the interval) and does not cap how many delivery tasks exist. Each fire submits a model turn on the owner's key. Combined with (2), a shared or leaked session is a billing bug.
4. **Kilo credential lookup.** `readStoredKiloToken()` reads `~/.pi/agent/auth.json` when `KILO_API_KEY` is empty, and if that file is missing the provider uses the API key `"free"`. On a developer machine the Worker can spend a personal Kilo token that was never put in `.dev.vars`. In a cloud agent VM, do not create that file. The `require("node:fs")` path is also a surprise inside a Worker module.
5. **Invalid `MOTS_PROVIDER` becomes `kilo`.** `apps/server/src/session.ts` falls back to `"kilo"` both when the variable is unset and when it is garbage. A typo should fail the session open, not silently switch provider.
6. **Error text is forwarded to the client.** Command failures send `error.message` on the socket. Some of those messages name conversation ids and internal request ids. Fine for a dev build, noisy for a public one.
7. **Username is a query parameter.** It is attribution only, and it is spoofable. That matches the current product (no accounts). Do not treat it as an identity later without a server check.
8. **Traces are on.** `wrangler.jsonc` enables observability traces. Before a public deploy, confirm prompts and API keys are not landing in trace payloads.

Do not add auth by stuffing a shared static bearer into the client. The client bundle is public.

## Correctness

**Recurrence is owned by the system.** `DeliverScheduledInstruction` sleeps until `runAt`, submits one user turn, and writes the next run in the same commit that clears the active delivery. That holds for a successful turn, a failed turn, and a thrown error, because an uncaught phase error faults the task for good. Only an abort or a missing conversation ends the routine. `nextRecurrenceRunAt` in `packages/agent/src/schedule.ts` handles DST and month length and is covered by `packages/agent/test/recurrence.test.ts`.

**Provider docs drifted from the code.** README and `.dev.vars.example` say the default provider is OpenRouter and the default model is `openai/gpt-6-luna`. `DEFAULT_MODELS` and `createMotsHarnessOptions` default to `kilo` / `reflection/beam-free`. The onboarding copy lists Kilo first. Both stories cannot be true. The code is what runs.

**The model pill can lie.** `ChatScreen` keeps `activeModelName` in React state, initialized to `reflection/beam-free`. `onModelSelect` updates that state and then fires `setModel` without waiting, and without rolling back. `activeProviderId` is stored and never read. The snapshot's `agent` (updated on `agent_changed`) is not what the header shows. `SessionSheet` also labels the Vercel secret `AI_GATEWAY_TOKEN` and the host `ai.gateway.vercel.dev`. The code uses `AI_GATEWAY_API_KEY` and `https://ai-gateway.vercel.sh/v1`.

**Catalog registration swallows failures.** `createMotsModels` wraps each `setProvider` in an empty `catch`. A bad catalog leaves that provider missing. The failure shows up later as a model error, not at startup.

**Memory forget is a substring.** `forget` drops every fact whose lowercase text contains the query. A short query can wipe unrelated facts. The cap is 100, and the oldest are spliced off with no notice to the user.

**Outbox is not an offline queue.** The README describes a reliable command queue. `CommandOutbox` does replay commands that were sent and not acknowledged, after the next `session.snapshot`. `submitPrompt`, `createConversation`, `forkConversation`, and `setModel` cancel the outbox entry immediately when `send` fails because the socket is not open (`packages/client/src/transport.ts`). A tap while reconnecting is dropped. The prompt text stays in the composer only because `ChatScreen` clears it after `accepted === true`. Create and fork do not have that safety.

**Root conversation is special-cased.** On snapshot, the client does not send `conversation.open` when the chosen id is `1`, because the server already watches the root in `#connect`. That is consistent. It is also easy to break if root stops being id 1.

**Join does not check that the session exists.** `parseJoinTarget` accepts any id shape and the app stores it. The object is created on connect. A typo creates an empty session instead of failing.

## Tests

`bun run test` on 2026-10-24: **70 pass, 0 fail**, across 6 files.

| Area | Covered | Not covered |
| --- | --- | --- |
| Protocol parse, scheduled-instruction text, inbox flattening | Yes | Round-trip of every server event variant, activity graph edge cases |
| Client socket happy path, terminal bad frame, silent run failure | Yes | Reconnect, outbox replay, cancel-on-send-failure, `setModel` |
| Gateway model mapping and one mocked chat-completions request | Yes | Kilo catalog adapter, `createMotsModels` failure paths |
| Mobile `format.ts` and the markdown parser | Yes | Components, navigation, storage, `parseJoinTarget` |
| `nextRecurrenceRunAt`, memory tools, search scan | No | The riskiest pure logic in the agent |
| Worker routes, `normalizeUsername`, `KeyedSerialQueue` | No | Pure and easy to test without wrangler |
| Durable Object, alarms, hibernation | No | Needs a Worker harness or a focused simulation |
| Real LLM end-to-end | No | README lists this as future work. Keep it out of CI until it is hermetic |

The README's "19 test" line is stale. It predates the agent and mobile tests.

A real-LLM test should not be the next CI job. It will be flaky and it will spend credits. First add pure tests and a Worker test that mocks the model port. Then one opt-in script, not required on every push.

## Errors, reconnection, outbox

What works:

- Reconnect uses exponential backoff from 400 ms to 10 s plus jitter, with no attempt cap. That is right for a phone.
- Close codes 1002 and 1009, and invalid frames, are terminal: the client clears the outbox and stops reconnecting. The person has to leave and re-enter.
- The server answers a failed command with `command.result` `ok: false` except for `presence.typing`, which is dropped on failure.
- Prompt submit sets a recovery alarm 60 s out before `conversation.submit`, so a crash mid-turn has a wakeup. `whenBusy: "followUp"` queues instead of rejecting.
- Send errors on a dead socket are caught and the socket is closed.

What does not:

- `state.error` is set by the client and **never read** by `apps/mobile`. A rejected command is invisible unless `submitPrompt` throws (the only throw is "a prompt is already pending", and that path uses `Alert`).
- The empty thread treats every non-connected status the same: a spinner and "Connessione all'agente Mots…" ("Connecting to the Mots agent…"). `status === "failed"` only changes the header dot color.
- There is no user-facing retry for a terminal failure.
- Typing indicators are fire-and-forget (`reportFailure = false`) and are not restored as commands. The server restores the typing bit from the hibernated attachment, which is the right place.
- Alarm reconciliation errors are logged and swallowed. A failed `#refreshAlarm` can leave a live task without a wakeup until something else touches the object.

## Performance and Durable Object cost

Measured: `wrangler deploy --dry-run` reports **Total Upload: 3030.74 KiB / gzip: 495.25 KiB**. That is one isolate loading Pi, the model SDKs, and the agent. Cold starts will not be tiny. Worth watching, not worth a rewrite.

Cost drivers that are structural:

- **Startup fetches.** `Session.#initialize` runs inside `blockConcurrencyWhile` and awaits `createMotsHarnessOptions` → `createMotsModels`. That function always tries the Kilo catalog and the Vercel catalog, sequentially, with `fetch` and no `AbortSignal`. A slow or hung host delays every new session, including OpenRouter-only deployments. Isolates cache a success for their lifetime; a failure clears the cache and the next session tries again.
- **Recovery alarms.** For every live task that is not blocked and not waiting on a future `runAt`, the object sets an alarm at `now + 60_000` and calls `waitForTask`, which resumes the scheduler. A stuck run wakes the object every minute. A healthy short turn should clear the alarm on the next refresh. This is reasonable. It becomes expensive if tasks stay "ready" or "running".
- **Reminders.** Each delivery is an alarm plus a full model turn. A 1-minute recurrence is an unbounded bill. There is no jitter budget and no daily cap.
- **Search.** `searchConversations` scans every ownerless conversation, 50 entries per commit, and `search_history` then pays for a child conversation and a second model call. Snippets are computed in the object. This is the first feature that will hurt after the transcript gets long.
- **Snapshots.** Connecting, creating, and forking rebuild the full conversation list and broadcast it. Event streams send agent snapshots to every watched socket. Fine at demo size. A long transcript is a large WebSocket message and a large React tree (`FlatList` of every entry, no windowing tuning beyond the default).
- **SQLite and traces.** One object per session stores the whole transcript. Observability traces are enabled. Both are correct for an MVP and both show up on the Cloudflare invoice once sessions stick around.
- **Memory in the prompt.** All facts are injected on every turn (`memorySection`). One hundred facts of 500 characters is a standing token cost.

`documentRetentionMs: 0` and `contextRetentionMs` left at the Pi default are a reasonable memory trade for a Durable Object. Do not set document retention to `Infinity` to "make it faster" without measuring isolate memory.

## Mobile UX

Present: onboarding, create, join by code or link, chat, streaming text, a markdown subset (bold, italic, code, headings, quotes, lists), tool progress, queued inputs, fork, share, leave, model sheet, quick prompts, keyboard avoidance, dark theme tokens.

Gaps, in the order a user hits them:

1. **Server URL is not editable.** `apiUrl` state is rendered as text. `setApiUrl` is never called. A physical phone cannot target `http://192.168.x.x:8787` unless the bundle was built with `EXPO_PUBLIC_MOTS_API_URL` or the join paste includes a full `http://host/sessions/:id` URL. The README says the onboarding URL stays editable. It does not.
2. **Failures are silent.** See the error section. The composer disables itself while disconnected, with no explanation when the connection has given up.
3. **Reminders do not notify.** No `expo-notifications`, no device token, no push from the deliver task. The phone must be in the conversation to see the reply. Background delivery is the difference between a reminder and a chat message that happens to be scheduled.
4. **Markdown is partial, images and voice are absent.** The roadmap item "markdown, images, and voice" is half done for markdown and not started for images and voice. The composer is text plus prompt prefixes. Inbox rendering understands an image part as the string `[Image]`; the user cannot send one. No links in the markdown parser.
5. **Model picker is a second source of truth.** Hardcoded lists in `SessionSheet` do not match `DEFAULT_MODELS` or the live catalogs. Selecting a model the provider did not register fails at runtime, and the pill still updates.
6. **Web accessibility.** `App.tsx` injects `outline: none` on `:focus` and `:focus-visible`. Keyboard users on the web preview lose focus.
7. **iOS.** `app.json` has a bundle id. `package.json` `export` is Android only. There is no `eas.json`, no privacy manifest, no push entitlement. `apps/mobile/gitignore` is not a `.gitignore`, so a future `expo prebuild` can commit `ios/` and `android/`.
8. **Copy and layering.** Italian UI strings are hardcoded, including one in the shared client reducer (`Il modello non ha risposto…` in `packages/client/src/session-state.ts`). The client package should not own locale copy.
9. **Identity storage.** AsyncStorage holds the session id in the clear under `mots.identity.v1`. Expected for an MVP. Any auth design has to replace this, not add a second secret beside it.
10. **`@expo-google-fonts/plus-jakarta-sans` is unused.** The app loads Instrument Sans. Dead dependency, not a user-facing bug.

The wide layout clamps the chat to 440 px and centers it. That is a deliberate phone frame on desktop, not a tablet UI.

## Developer experience

- Bun workspaces, a lockfile, TypeScript 6 strict, and `wrangler` 4.151.3 pinned in `apps/server`. Dependencies on Pi are exact (`1.2.0`), which is what you want.
- No CI existed before `.github/workflows/ci.yml`. No ESLint, Prettier, or Husky. `noUnusedLocals` is off, which is why `setApiUrl` and `activeProviderId` typecheck clean.
- `worker-configuration.d.ts` is hand-written. `KILO_API_KEY` is on `Env` and missing from the `ProcessEnv` pick. Easy to forget the next provider.
- README commands are PowerShell-oriented (`Copy-Item`). They are accurate enough. The Node-versus-Bun warning is the most important paragraph in the file and it is correct for `wrangler dev`.
- `bun run check` is typecheck plus dry-run. It does not start a server and does not need a provider key. Agents should treat it as the merge gate.
- The repo root contains `mots_apple_trailer.mp4` (~6.7 MB) and `trailer.html`. They are not referenced by the app. They slow every clone and every cloud agent checkout. Leave them until the owner chooses Git LFS or a release asset. Do not delete them in a drive-by.

## README roadmap, mapped to the code

| README item | State in the tree |
| --- | --- |
| Auth, rate limiting, CORS policy | Not started. CORS is `*`. |
| Push notifications for reminders | Not started. Delivery is an in-conversation model turn. |
| Markdown, images, voice | Markdown subset shipped in `apps/mobile/src/markdown.ts`. No images, no voice, no links. |
| iOS build and demo deploy | Android `expo export` only. `wrangler deploy` script exists. No staging env, no EAS, no public hostname in config. |
| Real-LLM end-to-end | Not present. Local verification is described as manual. |
| Protocol, client, DO, tools, mobile shell, typecheck, dry-run | Present. Tests are ahead of the README count. |

## Roadmap for separate agents

Each row is one pull request. Do not combine a security task with a UI task. Branch from current `main`. Run `bun run check` and `bun run test`. Do not commit secrets. Do not remove the trailer. Acceptance is the behavior change plus a test where one is specified.

### Block a public deploy (do these first)

**M1. Fail closed on provider configuration.** In `apps/server/src/session.ts`, unset `MOTS_PROVIDER` may keep the code default (`kilo`). An unknown value must fail initialization with a logged error, not silently select Kilo. Add a unit test for `isMotsProviderId` (already exists) and a small pure helper the Worker calls. Update `.dev.vars.example` to list `KILO_API_KEY` and the real default. Do not change the successful default in the same PR as the README rewrite if that makes review harder; M8 can fix prose.

**M2. Allowlist `conversation.setModel`.** Reject providers outside `MOTS_PROVIDERS` and model ids that `createMotsModels` did not register. Return `command.result` `ok: false` with a stable `code`. Add a protocol test if the error shape changes, and a pure test for the allowlist function. Do not let the mobile pill update before the server accepts; that half is M5 if it does not fit here.

**M3. Schedule quotas.** Cap active delivery tasks per session (pick a small number, document it) and reject intervals below a floor higher than "every minute" unless a single constant says otherwise. Cover `nextRecurrenceRunAt` with tests: minute/hour math, month-end clamp, a DST spring-forward, and the safety limit. This PR may add the tests even if the cap lands in a follow-up, but prefer one PR that does both the cap and the tests.

**M4. Issued session ids.** `POST /api/sessions` should mint the id and persist it (a Worker KV or a single coordinating object is enough). The WebSocket route should refuse unknown ids with 404 and must not call `getByName` for them. Keep join-by-code working for ids that were issued. Add route tests with a mocked `SESSIONS` binding if you can do it without a full Miniflare novel; otherwise a pure function for "is this id issued" plus a comment about the integration gap. Do not implement user accounts in this PR.

**M5. CORS allowlist and a blunt rate limit.** Read allowed origins from `MOTS_CORS_ORIGINS` (comma-separated). Default in dev can stay `*` only when that var is unset, and the README must say production must set it. Add a Cloudflare rate-limit or a cheap counter on `POST /api/sessions` and on upgrades. Document the chosen binding in `wrangler.jsonc`. This PR is allowed to be the first one that edits `wrangler.jsonc` bindings.

**M6. Stop reading `~/.pi/agent/auth.json` from the Worker.** Remove `readStoredKiloToken` from the request path, or gate it behind an explicit `MOTS_ALLOW_LOCAL_KILO_AUTH=1` that defaults off. The `"free"` fallback can stay if Kilo's free tier is intentional; log that source once. Add a test that `providerAuthContext` does not touch the filesystem (partially true today: `fileExists` returns false, but the Kilo resolver bypasses it).

### Make the product true

**M7. Durable recurrence.** Done in `commitDeliveryOutcome`: a finished run, successful or failed, writes its next row, and a routine stops after three failed runs in a row, with a push to the user. An abort or a missing conversation also stops it. The original requirement follows. When a delivery with `recurrence` finishes successfully, create the next `DeliverScheduledInstruction` in the same commit that clears the active delivery, using `nextRecurrenceRunAt`. Keep `sourceScheduleId` working so an in-flight model call does not double-schedule. The prompt text can still tell the model what happened; it must not be the only writer of the next row. Test the transition with a fake runtime or by extracting the "next instruction" decision into a pure function and testing that.

**M8. Docs match the code.** README provider table, test count, and "URL is editable" sentence. `SessionSheet` provider endpoints and the Vercel secret name. No behavior change beyond copy. Italian UI stays Italian.

**M9. Server URL field.** Wire the existing `apiUrl` state to a `TextInput` on onboarding, persist it through `saveIdentity`, and keep `parseJoinTarget` host overrides. Test `normalizeBaseUrl` and `parseJoinTarget` (move tests next to `apps/mobile/test`). Do not change the Android emulator default.

**M10. Visible connection and command errors.** Render `state.error`. Distinguish `failed` from `connecting`, and offer a way to reconnect after a terminal close (today the client refuses `connect()` once `#terminal` is set; add an explicit reset). Add a client test that a send failure surfaces `state.error` and that a 1002 close does not reconnect by itself.

**M11. Startup catalogs.** Fetch a provider's catalog only when that provider is selected. Add a timeout (a few seconds) and fall back to the hardcoded Kilo models you already have. `blockConcurrencyWhile` must not wait on the network for a provider the session will not call. Test the selector with a stubbed `fetch`.

**M12. Outbox while disconnected.** For create, fork, prompt, and setModel, leave the command pending when the socket is down and replay it after the next snapshot, instead of `cancel`. One in-flight prompt at a time stays. Add client tests for "enqueue offline, replay once, ack clears". This changes behavior; call it out in the PR.

### Product roadmap from the README

**M13. Push token protocol.** A client command to register and clear an Expo push token on the session, stored in a session doc, validated and size-limited. No send yet. No auth redesign beyond "the socket that already has the session id can register".

**M14. Send a push from delivery.** After the scheduled turn is submitted, POST to Expo's push API if a token is stored. Failure to push must not fail the delivery. Keep the in-conversation message. Secrets: `EXPO_ACCESS_TOKEN` if you use one, documented in `.dev.vars.example`, not committed.

**M15. Mobile push registration.** `expo-notifications` permission, register on connect, send M13's command. This PR needs a dev client or EAS; Expo Go may be enough to develop and not enough to ship iOS. Say which one you verified.

**M16. Markdown links.** Extend the parser and `MarkdownText` for links only. Open them with the platform linking API. Tests for the parser. Do not add a new markdown dependency unless the custom parser is actually blocking you; it is small and already tested.

**M17. Image messages.** Protocol already flattens an image part to `[Image]` in the inbox. Add a real client command payload, a size limit, and rendering. Voice is a separate PR (M18). Do not bundle image upload with voice.

**M18. Voice messages.** Record, upload or inline a bounded clip, transcribe or send as audio if the selected model supports it. Most current defaults are text. Ship "record and send a transcript" if audio input is not actually supported by the configured model. Do not pretend.

**M19. EAS and iOS.** Add `eas.json` for a preview profile, fix `apps/mobile/gitignore` by renaming it to `.gitignore` (do not delete the rules), and document the Apple credentials the owner must create. Do not commit `ios/` or provisioning profiles. Android export must still run.

**M20. Staging deploy.** A `staging` wrangler env, a dry-run in CI against that config, and a README section with the exact `wrangler secret put` commands. Do not point the mobile default at production. Do not deploy from CI until M1–M5 are merged and the owner has created the Cloudflare API token.

### After the above, if an agent is still looking for work

**M21. Search index.** Persist a term index or limit the scan (time budget, max bytes) and return `truncated` honestly. Keep the subagent tool, but do not scan the world inside the parent turn.

**M22. ESLint.** One flat config, `noUnusedLocals` equivalent, CI step. Fix only the violations you introduce plus the known unused bindings (`setApiUrl` will already be fixed by M9). Do not reformat the repo.

**M23. Fake-LLM Worker smoke.** Miniflare or `wrangler dev` against a stubbed model, asserting health, create, WebSocket snapshot, and one prompt submission id. Opt-in if it needs a key. Required in CI only when it is hermetic.

**M24. Move the Italian "no response" string** out of `packages/client` into the app. Keep a stable `runError` code on the state.

**M25. Trailer.** Ask the owner before moving `mots_apple_trailer.mp4` to Git LFS or a release. Do not delete it.

Suggested order for the first wave of agents, with no overlap in files: M3 (schedule tests and cap), M6 (Kilo auth file), M8 (docs), M9 (URL field), M11 (catalog fetch). M4 and M5 touch the Worker router and should be sequential. M7 should land after M3's tests exist. M2 after M11 so the allowlist sees the models that were actually registered. M13–M15 are a chain. M19 before M20 only if the demo must be on a phone; a public Worker can ship to the web preview earlier, but not before M4 and M5.

## What this setup PR deliberately did not do

- No change to runtime behavior, dependencies, or the lockfile.
- No deletion of the trailer or of unused dependencies.
- No auth implementation. The design constraint is written above so the agent that takes M4 does not invent a second product.
- No secrets in the repo, the workflow, or `.cursor/environment.json`.

## Verification recorded with this document

Commands run on Linux with Node v22.23.4 and Bun 1.4.4, after `bun install --frozen-lockfile`:

- `bun run typecheck`: `@mots/protocol`, `@mots/client`, `@mots/agent`, `@mots/server`, `@mots/mobile` all exited 0.
- `bun run test`: 70 pass, 0 fail, 144 expects, 6 files.
- `bun run check:server`: Wrangler 4.151.3 dry-run exited 0. Upload 3030.74 KiB / gzip 495.25 KiB. Binding `env.SESSIONS` (`Session`).

`wrangler dev` was not required for those commands. If a later agent sees HTTP 503 from the dev server, start Wrangler with Node as `AGENTS.md` describes before changing server code.
