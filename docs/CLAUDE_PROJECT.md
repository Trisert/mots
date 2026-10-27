# Working on Mots from a Claude Project

This page is for picking up work on Mots from a Claude Project on claude.ai, without losing the context of earlier sessions. The state lives in the repository, not in the chat: whoever picks up the work reads the files below.

## Project knowledge

Add these files to the project knowledge (through the project's GitHub integration, so they stay in sync with `main`):

| File | Why |
| --- | --- |
| `AGENTS.md` | Operating rules: setup, commands, conventions, things not to do. |
| `docs/ROADMAP.md` | Product plan, M-task status, competitor analysis, Cua Spaces integration design. |
| `docs/ANALYSIS.md` | Technical audit and detailed description of each M task. |
| `README.md` | Product overview. |
| `packages/protocol/src/index.ts` | The wire protocol: every new function goes through here. |
| `packages/agent/src/chat.ts` | Agent preamble, tools and sections. |
| `apps/server/src/session.ts` | The `Session` Durable Object. |
| `apps/mobile/src/palette.ts`, `apps/mobile/src/theme.ts`, `apps/mobile/src/components/Mascot.tsx` | Design system tokens and the mascot in code. |
| `packages/agent/src/model-catalog.ts` | Which models and providers the app can pick. |

The design system and the mockups are Claude Artifacts, not repository files. They are private: to open them from the project they must be shared with the people working on it.

- Mots design system: https://claude.ai/artifact/HWoqJFg45sk4wqpKVKuMSW
- Screen mockups: https://claude.ai/artifact/B2AKYaN547r1ghPJbMqSK9

After each merge to `main`, resync the project files.

## Project instructions

Paste this text into the project instructions:

```text
You work on Mots, a mobile-first AI companion (Expo + Cloudflare Worker + Durable Object with Pi Durable).
Reply in Italian. Code, comments and the documents in docs/ are in English; the app's
user-facing text is localized (English default, Italian available in Settings).
Before proposing changes, read AGENTS.md and docs/ROADMAP.md. Pick the next work from the
"M-task status" table and the phases in docs/ROADMAP.md: one task per pull request.
Do not invent the state of the code: if a file is not in the project knowledge, say so and ask
for it to be added, or suggest opening a Claude Code session on the repository.
Product decisions made here must be written in docs/ROADMAP.md with a PR, not left only in chat.
```

## From the project to the code

A Claude Project is for discussing, planning and reviewing. To change the code, open a Claude Code session on the `Trisert/mots` repository (web, desktop or terminal) and paste a prompt like this:

```text
Read AGENTS.md and docs/ROADMAP.md. Implement the task <task name> as described there.
One task per PR. Run bun run check and bun run test before committing. Update the
"M-task status" table in docs/ROADMAP.md in the same PR.
```

Claude Code reads `CLAUDE.md` at the root, which imports `AGENTS.md`, so the repository rules apply there too.

For independent work, parallel subagents can be used, each in a separate worktree and on different files, as was done on 2026-10-26 for M12, M24 and `forget`. Before the push, whoever coordinates reviews each diff and reruns `bun run check` and `bun run test` on the combined result.

## Status as of this page

Updated on `main` (commit `714d63a`, PR #25 merged), 2026-10-26. PR #24 (session timezone, `forget`, M12, M24, accessibility) and PR #25 are on `main`. They include:

- SVG icons instead of `[!]`, `[+]`, `[~]` in errors and tool rows.
- `bun run setup` and `bun run dev [--web]`: local generated secrets, and an app that points at the Worker on the LAN, to try on a phone.
- Single-line input field, without the browser focus rectangle.
- Model picker on its own screen, loaded from `GET /api/sessions/:code/models`. Provider keys stay on the server.
- Mots design system in the app: palette, Figtree, pill shapes and the animated speech-bubble mascot.

`bun run test`: 274 tests, 0 failing. `bun run check` passes. Tried in the browser against a local Worker with `MOTS_FAKE_LLM=stub`, in light and dark theme. Not tried on a real phone.

Recommended next steps, in order:

1. Routines and memories in the protocol and the server, then the bottom bar (Chat, Routine, Memoria, Profilo) from the mockups.
2. M15: push registration in the app.
3. Accounts and the spend cap (Phase 1 in `docs/ROADMAP.md`).
