import { describe, expect, test } from "bun:test";
import type { Tx } from "@earendil-works/pi-durable";
import { MAX_PUSH_TOKEN_CHARACTERS, parseClientCommand } from "@mots/protocol";
import { applyPushTokenCommand, PushTokenDoc, useExpoAccessToken } from "../src/push-token.ts";
import {
  DeliverScheduledInstruction,
  type ScheduleDelivery,
  type ScheduledInstruction,
} from "../src/schedule.ts";

const now = Date.parse("2026-05-01T00:00:00.000Z");
const conversationId = 7 as ScheduledInstruction["conversationId"];
const TOKEN = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type Captured = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
};

const header = (headers: Record<string, string>, name: string): string | undefined => {
  const key = Object.keys(headers).find((item) => item.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : headers[key];
};

const capture = (input: unknown, init: RequestInit | undefined): Captured => {
  const headers: Record<string, string> = {};
  const source = init?.headers;
  if (source instanceof Headers) {
    source.forEach((value, key) => {
      headers[key] = value;
    });
  } else if (Array.isArray(source)) {
    for (const [key, value] of source) headers[key] = value;
  } else if (source !== undefined) {
    Object.assign(headers, source);
  }
  return {
    url: String(input),
    method: init?.method ?? "GET",
    headers,
    body: typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {},
  };
};

const scheduled = (text = "Send the briefing"): ScheduledInstruction => ({
  id: "schedule:source",
  conversationId,
  instruction: text,
  name: "Briefing",
  runAt: now,
  recurrence: { cadence: { unit: "day", interval: 1 }, timezone: "UTC" },
});

const delivery = (value: ScheduledInstruction): ScheduleDelivery => ({
  scheduleId: value.id,
  conversationId: value.conversationId,
  instruction: value.instruction,
  name: value.name,
  runAt: value.runAt,
  recurrence: value.recurrence,
});

function register(doc: { token?: string }, token: string, requestId: string): void {
  const command = parseClientCommand(
    JSON.stringify({ type: "pushToken.register", requestId, token }),
  );
  if (command.type !== "pushToken.register") throw new Error(command.type);
  applyPushTokenCommand(doc, command);
}

function clear(doc: { token?: string }, requestId: string): void {
  const command = parseClientCommand(JSON.stringify({ type: "pushToken.clear", requestId }));
  if (command.type !== "pushToken.clear") throw new Error(command.type);
  applyPushTokenCommand(doc, command);
}

function expectNextRow(created: readonly ScheduledInstruction[]): void {
  const successor = created[0];
  if (successor === undefined) throw new Error("expected a successor");
  expect(created).toHaveLength(1);
  expect(successor.id).not.toBe("schedule:source");
  expect(successor).toMatchObject({
    instruction: "Send the briefing",
    name: "Briefing",
    conversationId,
    runAt: Date.parse("2026-05-02T00:00:00.000Z"),
    recurrence: { cadence: { unit: "day", interval: 1 }, timezone: "UTC" },
  });
}

type Mode = "done" | "unanswered" | "missing" | "throw";

async function runDeliver(options: {
  doc: { token?: string };
  mode?: Mode;
  phase?: "deliver" | "abort";
  accessToken?: string;
  instructionText?: string;
  respond?: () => Response | Promise<Response>;
}) {
  const order: string[] = [];
  const requests: Captured[] = [];
  const reports: unknown[] = [];
  const submitted: string[] = [];
  let outcome: unknown;
  let thrown: unknown;
  const input = scheduled(options.instructionText);
  const created: ScheduledInstruction[] = [];
  const deliveries = { active: [delivery(input)] };
  const tx = {
    doc: async () => deliveries,
    createTask: async (_task: unknown, next: ScheduledInstruction) => {
      created.push(next);
      return "created";
    },
  };
  const mode = options.mode ?? "done";
  const previous = globalThis.fetch;
  try {
    useExpoAccessToken(options.accessToken);
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      order.push("push");
      requests.push(capture(url, init));
      if (options.respond !== undefined) return await options.respond();
      return new Response(JSON.stringify({ data: { status: "ok", id: "ticket-1" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const runtime = {
      now: () => now,
      report: (error: unknown) => {
        reports.push(error);
      },
      snapshot: async (token: unknown) => {
        order.push("snapshot");
        if (token !== PushTokenDoc) throw new Error("unexpected document");
        return options.doc;
      },
      conversation: async () => {
        if (mode === "missing") return undefined;
        return {
          submit: async (draft: { content: string }) => {
            order.push("submit");
            if (mode === "throw") throw new Error("submit failed");
            submitted.push(draft.content);
            return {
              wait: async () => {
                order.push("wait");
                return { status: mode === "unanswered" ? "unanswered" : "done" };
              },
            };
          },
        };
      },
      commit: async (change: (transaction: Tx) => Promise<unknown>) => {
        order.push("commit");
        outcome = await change(tx as unknown as Tx);
      },
    };
    const task = { input } as never;
    const context = undefined as never;
    try {
      if ((options.phase ?? "deliver") === "abort") {
        await DeliverScheduledInstruction.definition.abort(task, runtime as never, context);
      } else {
        await DeliverScheduledInstruction.definition.phases.deliver(
          task,
          runtime as never,
          context,
        );
      }
    } catch (error) {
      thrown = error;
    }
  } finally {
    globalThis.fetch = previous;
    useExpoAccessToken(undefined);
  }
  return { order, requests, reports, submitted, outcome, thrown, created };
}

describe("push token delivery", () => {
  test("stores one token, pushes after success, and clear removes it", async () => {
    const doc: { token?: string } = {};
    const replacement = "ExpoPushToken[yyyyyyyyyyyyyyyyyyyyyy]";
    register(doc, TOKEN, "req-1");
    register(doc, replacement, "req-2");
    expect(doc).toEqual({ token: replacement });

    const delivered = await runDeliver({ doc, accessToken: "expo-test-token" });
    expect(delivered.thrown).toBeUndefined();
    expect(delivered.order).toEqual(["submit", "wait", "snapshot", "push", "commit"]);
    expect(delivered.submitted[0]).toContain("Send the briefing");
    expect(delivered.outcome).toEqual({
      status: "terminal",
      outcome: { status: "completed", result: null },
    });
    expectNextRow(delivered.created);
    expect(delivered.requests).toHaveLength(1);
    const request = delivered.requests[0];
    if (request === undefined) throw new Error("expected a push");
    expect(request.url).toBe(EXPO_PUSH_URL);
    expect(request.method).toBe("POST");
    expect(header(request.headers, "authorization")).toBe("Bearer expo-test-token");
    expect(header(request.headers, "content-type")).toBe("application/json");
    expect(request.body).toMatchObject({
      to: replacement,
      title: "Briefing",
      body: "Send the briefing",
      sound: "default",
      priority: "high",
      data: { scheduleId: "schedule:source", conversationId },
    });
    expect(JSON.stringify(request.body)).not.toContain("expo-test-token");

    clear(doc, "req-3");
    expect(doc).toEqual({});
    expect(Object.hasOwn(doc, "token")).toBe(false);

    const afterClear = await runDeliver({ doc, accessToken: "expo-test-token" });
    expect(afterClear.thrown).toBeUndefined();
    expect(afterClear.order).toEqual(["submit", "wait", "snapshot", "commit"]);
    expect(afterClear.requests).toHaveLength(0);
    expect(afterClear.submitted[0]).toContain("Send the briefing");
    expectNextRow(afterClear.created);
  });

  test("a push error still submits the reminder and writes the next recurrence", async () => {
    const doc: { token?: string } = {};
    register(doc, TOKEN, "req-1");
    const result = await runDeliver({
      doc,
      respond: () => {
        throw new Error("network down");
      },
    });
    expect(result.thrown).toBeUndefined();
    expect(result.order).toEqual(["submit", "wait", "snapshot", "push", "commit"]);
    expect(result.submitted[0]).toContain("Send the briefing");
    expect(result.outcome).toEqual({
      status: "terminal",
      outcome: { status: "completed", result: null },
    });
    expectNextRow(result.created);
    expect(result.reports).toHaveLength(1);
    expect((result.reports[0] as Error).message).toBe("network down");
    expect((result.reports[0] as Error).message).not.toContain(TOKEN);
  });

  test("an Expo HTTP error still completes delivery", async () => {
    const doc: { token?: string } = {};
    register(doc, TOKEN, "req-1");
    const result = await runDeliver({
      doc,
      respond: () => new Response(JSON.stringify({ token: TOKEN, error: "nope" }), { status: 500 }),
    });
    expect(result.thrown).toBeUndefined();
    expect(result.submitted[0]).toContain("Send the briefing");
    expectNextRow(result.created);
    expect((result.reports[0] as Error).message).toBe("Expo push failed with status 500");
    expect((result.reports[0] as Error).message).not.toContain(TOKEN);
  });

  test("an Expo ticket error still completes delivery", async () => {
    const doc: { token?: string } = {};
    register(doc, TOKEN, "req-1");
    const result = await runDeliver({
      doc,
      respond: () =>
        new Response(
          JSON.stringify({
            data: {
              status: "error",
              message: `token ${TOKEN} is not a registered push notification recipient`,
              details: { error: "DeviceNotRegistered" },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    });
    expect(result.thrown).toBeUndefined();
    expectNextRow(result.created);
    expect((result.reports[0] as Error).message).toBe(
      "Expo push was rejected (DeviceNotRegistered)",
    );
    expect((result.reports[0] as Error).message).not.toContain(TOKEN);
  });

  test("does not push a failed, aborted, or missing-conversation delivery", async () => {
    const doc: { token?: string } = {};
    register(doc, TOKEN, "req-1");

    const unanswered = await runDeliver({ doc, mode: "unanswered" });
    expect(unanswered.thrown).toBeUndefined();
    expect(unanswered.order).toEqual(["submit", "wait", "commit"]);
    expect(unanswered.requests).toHaveLength(0);
    expect(unanswered.created).toEqual([]);
    expect(unanswered.submitted[0]).toContain("Send the briefing");

    const missing = await runDeliver({ doc, mode: "missing" });
    expect(missing.thrown).toBeUndefined();
    expect(missing.order).toEqual(["commit"]);
    expect(missing.requests).toHaveLength(0);
    expect(missing.created).toEqual([]);
    expect((missing.reports[0] as Error).message).toContain("is missing");

    const failed = await runDeliver({ doc, mode: "throw" });
    expect((failed.thrown as Error).message).toBe("submit failed");
    expect(failed.order).toEqual(["submit", "commit"]);
    expect(failed.requests).toHaveLength(0);
    expect(failed.created).toEqual([]);
    expect(failed.outcome).toEqual({ status: "running", checkpoint: { phase: "deliver" } });

    const aborted = await runDeliver({ doc, phase: "abort" });
    expect(aborted.thrown).toBeUndefined();
    expect(aborted.order).toEqual(["commit"]);
    expect(aborted.requests).toHaveLength(0);
    expect(aborted.created).toEqual([]);
    expect(aborted.outcome).toEqual({ status: "terminal", outcome: { status: "aborted" } });
  });

  test("sends a protocol-sized token without shortening it", async () => {
    const prefix = "ExpoPushToken[";
    const token = `${prefix}${"a".repeat(MAX_PUSH_TOKEN_CHARACTERS - prefix.length - 1)}]`;
    expect(token.length).toBe(MAX_PUSH_TOKEN_CHARACTERS);
    const doc: { token?: string } = {};
    register(doc, token, "req-limit");
    const result = await runDeliver({ doc });
    expect(result.requests[0]?.body.to).toBe(token);
    expectNextRow(result.created);
  });

  test("keeps the full instruction in the conversation and clips only the push body", async () => {
    const text = "A".repeat(600);
    const doc: { token?: string } = {};
    register(doc, TOKEN, "req-1");
    const result = await runDeliver({ doc, instructionText: text });
    expect(result.submitted[0]?.includes(text)).toBe(true);
    const body = result.requests[0]?.body.body;
    expect(typeof body).toBe("string");
    expect((body as string).length).toBeLessThanOrEqual(500);
    expect((body as string).endsWith("...")).toBe(true);
    expect(result.requests[0]?.body.to).toBe(TOKEN);
    expect(result.created[0]?.instruction).toBe(text);
  });

  test("omits the authorization header when the access token is blank", async () => {
    const doc: { token?: string } = {};
    register(doc, TOKEN, "req-1");
    const blank = await runDeliver({ doc, accessToken: "   " });
    const request = blank.requests[0];
    if (request === undefined) throw new Error("expected a push");
    expect(header(request.headers, "authorization")).toBeUndefined();
    const unset = await runDeliver({ doc });
    expect(header(unset.requests[0]?.headers ?? {}, "authorization")).toBeUndefined();
  });
});
