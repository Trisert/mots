import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { HTTP_ERROR, parseServerEventEnvelope } from "@mots/protocol";
import { verifySessionCapability } from "../src/session-auth.ts";

const SECRET = "test-session-secret-0123456789";
const CREATE = "test-create-token-0123456789";
const serverRoot = fileURLToPath(new URL("..", import.meta.url));
const serverRequire = createRequire(new URL("../package.json", import.meta.url));

type SmokeRuntime = {
  ready: Promise<URL>;
  dispose(): Promise<void>;
};

type MiniflareModule = {
  Miniflare: new (options: unknown) => SmokeRuntime;
  convertV4MiniflareOptions: (options: unknown) => unknown;
};

const wranglerRequire = createRequire(serverRequire.resolve("wrangler/package.json"));
const { Miniflare, convertV4MiniflareOptions } = wranglerRequire("miniflare") as MiniflareModule;

class SocketLog {
  readonly messages: string[] = [];
  readonly #waiters: Array<(message: string) => void> = [];

  push(message: string): void {
    this.messages.push(message);
    for (const waiter of this.#waiters) waiter(message);
  }

  waitFor(predicate: (message: string) => boolean, timeoutMs: number): Promise<string> {
    const existing = this.messages.find(predicate);
    if (existing !== undefined) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#waiters.splice(this.#waiters.indexOf(onMessage), 1);
        reject(new Error("Timed out waiting for a server event."));
      }, timeoutMs);
      const onMessage = (message: string): void => {
        if (!predicate(message)) return;
        clearTimeout(timer);
        this.#waiters.splice(this.#waiters.indexOf(onMessage), 1);
        resolve(message);
      };
      this.#waiters.push(onMessage);
    });
  }
}

function bundleWorker(outdir: string): Promise<void> {
  const wrangler = join(dirname(serverRequire.resolve("wrangler/package.json")), "bin/wrangler.js");
  return new Promise((resolve, reject) => {
    const child = spawn(
      "node",
      [wrangler, "deploy", "--dry-run", "--outdir", outdir],
      {
        cwd: serverRoot,
        env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`wrangler deploy --dry-run exited ${code}\n${stderr}`));
    });
  });
}

describe("fake LLM smoke", () => {
  let outdir = "";
  let runtime: SmokeRuntime | undefined;
  const outbound: string[] = [];
  let base: URL;

  beforeAll(async () => {
    outdir = await mkdtemp(join(tmpdir(), "mots-fake-llm-"));
    await bundleWorker(outdir);
    runtime = new Miniflare(
      convertV4MiniflareOptions({
        rootPath: outdir,
        scriptPath: "index.js",
        modules: true,
        compatibilityDate: "2026-09-23",
        compatibilityFlags: ["nodejs_compat"],
        durableObjects: {
          SESSIONS: { className: "Session", useSQLite: true },
        },
        bindings: {
          MOTS_SESSION_SECRET: SECRET,
          MOTS_CREATE_TOKEN: CREATE,
          MOTS_FAKE_LLM: "stub",
        },
        outboundService(request: { url: string }) {
          outbound.push(new URL(request.url).origin + new URL(request.url).pathname);
          return new Response("outbound blocked", { status: 500 });
        },
      }),
    );
    base = await runtime.ready;
  }, 30_000);

  afterAll(async () => {
    await runtime?.dispose();
    if (outdir.length > 0) await rm(outdir, { recursive: true, force: true });
  });

  test("checks health, creates a session, reads a snapshot, and submits one prompt", async () => {
    const health = await fetch(new URL("/api/health", base));
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ ok: true, service: "mots" });

    const missing = await fetch(new URL("/api/sessions", base), { method: "POST" });
    expect(missing.status).toBe(401);
    expect(((await missing.json()) as { error: string }).error).toBe(HTTP_ERROR.unauthorized);

    const created = await fetch(new URL("/api/sessions", base), {
      method: "POST",
      headers: { Authorization: `Bearer ${CREATE}` },
    });
    expect(created.status).toBe(201);
    const body = (await created.json()) as { sessionId: string; socketPath: string };
    const sessionId = await verifySessionCapability(SECRET, body.sessionId);
    expect(sessionId).toBeString();
    expect(body.socketPath).toBe(`/api/sessions/${body.sessionId}`);

    const socketUrl = new URL(body.socketPath, base);
    socketUrl.protocol = "ws:";
    const log = new SocketLog();
    const ws = new WebSocket(socketUrl);
    ws.addEventListener("message", (event) => {
      log.push(String(event.data));
    });
    try {
      const opened = new Promise<void>((resolve, reject) => {
        ws.addEventListener("open", () => resolve());
        ws.addEventListener("error", () => reject(new Error("WebSocket failed to open.")));
      });
      const snapshotMessage = await log.waitFor(
        (message) => message.includes('"type":"session.snapshot"'),
        8_000,
      );
      await opened;
      const snapshot = parseServerEventEnvelope(snapshotMessage);
      expect(snapshot.type).toBe("session.snapshot");
      if (snapshot.type !== "session.snapshot") return;
      const conversationId = snapshot.session.conversations[0]?.id;
      expect(conversationId).toBeGreaterThan(0);
      if (conversationId === undefined) return;

      const missingConversationRequestId = "set-model-missing-conversation";
      ws.send(
        JSON.stringify({
          type: "conversation.setModel",
          requestId: missingConversationRequestId,
          conversationId: 999,
          provider: "kilo",
          modelId: "reflection/beam-free",
        }),
      );
      const missingConversationResultMessage = await log.waitFor(
        (message) =>
          message.includes('"type":"command.result"') &&
          message.includes(`"requestId":"${missingConversationRequestId}"`),
        8_000,
      );
      expect(parseServerEventEnvelope(missingConversationResultMessage)).toMatchObject({
        type: "command.result",
        command: "conversation.setModel",
        requestId: missingConversationRequestId,
        ok: false,
      });

      const requestId = "fake-llm-prompt";
      ws.send(
        JSON.stringify({
          type: "prompt.submit",
          requestId,
          conversationId,
          content: "Ciao",
        }),
      );
      const resultMessage = await log.waitFor(
        (message) =>
          message.includes('"type":"command.result"') && message.includes(`"requestId":"${requestId}"`),
        8_000,
      );
      const result = parseServerEventEnvelope(resultMessage);
      expect(result).toMatchObject({
        type: "command.result",
        command: "prompt.submit",
        requestId,
        ok: true,
        conversationId,
      });
      if (result.type !== "command.result" || result.ok !== true) return;
      expect(result.submissionId).toBeGreaterThan(0);

      const reply = await log.waitFor((message) => message.includes('"text":"stub-ok"'), 8_000);
      expect(reply).toContain('"text":"stub-ok"');
      expect(outbound).toEqual([]);
    } finally {
      ws.close();
    }
  }, 30_000);
});
