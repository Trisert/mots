import { describe, expect, test } from "bun:test";
import type { ToolExecutionApi } from "@earendil-works/pi-durable";
import type { ScheduledInstruction } from "../src/schedule.ts";
import { createScheduleTool } from "../src/tools.ts";

const context = undefined as never;
const limits = { maxActive: 1, minRecurrenceMs: 15 * 60 * 1000 };

type Delivery = {
  scheduleId: string;
  conversationId: number;
  instruction: string;
  name?: string;
  runAt: number;
  recurrence?: ScheduledInstruction["recurrence"];
  successor?: ScheduledInstruction;
};

function openTasks(count: number): { state: { status: string } }[] {
  return Array.from({ length: count }, () => ({ state: { status: "waiting" } }));
}

function harness(options: {
  readonly open?: number;
  readonly intent?: { scheduled?: ScheduledInstruction };
  readonly snapshotIntent?: { scheduled?: ScheduledInstruction };
  readonly deliveries?: { active: Delivery[] };
}) {
  const created: unknown[] = [];
  const intent = options.intent ?? {};
  const snapshotIntent = options.snapshotIntent ?? intent;
  const deliveries = options.deliveries ?? { active: [] };
  let scans = 0;
  const api = {
    taskId: "task-1",
    conversationId: 1,
    snapshot: async (token: { definition?: { kind?: string } }) => {
      if (token.definition?.kind === "app.schedule-intent") return snapshotIntent;
      if (token.definition?.kind === "app.schedule-deliveries") return deliveries;
      return undefined;
    },
    commit: async (change: (tx: {
      doc: (token: { definition?: { kind?: string } }) => Promise<unknown>;
      scanTasks: () => Promise<{ items: { state: { status: string } }[] }>;
      createTask: (task: unknown, input: unknown) => Promise<string>;
    }) => Promise<unknown>) =>
      change({
        doc: async (token: { definition?: { kind?: string } }) => {
          const kind = token.definition?.kind;
          if (kind === "app.schedule-intent") return intent;
          if (kind === "app.schedule-deliveries") return deliveries;
          throw new Error(`unexpected doc ${kind}`);
        },
        scanTasks: async () => {
          scans += 1;
          return { items: openTasks(options.open ?? 0) };
        },
        createTask: async (_task, input) => {
          created.push(input);
          return "created";
        },
      }),
  };
  return {
    api: api as unknown as ToolExecutionApi,
    created,
    intent,
    deliveries,
    scans: () => scans,
  };
}

const tool = createScheduleTool(async () => {}, limits);

describe("schedule tool caps", () => {
  test("creates a one-shot when there is room", async () => {
    const session = harness({ open: 0 });
    const result = await tool.execute(
      { instruction: "Check the weather", delaySeconds: 30 },
      session.api,
      context,
    );
    expect(session.created).toHaveLength(1);
    expect(result.details).toMatchObject({ instruction: "Check the weather" });
  });

  test("refuses a new routine once the active cap is full and does not store the intent", async () => {
    const session = harness({ open: 1 });
    await expect(
      tool.execute({ instruction: "Another", delaySeconds: 30 }, session.api, context),
    ).rejects.toThrow("1 routine");
    expect(session.created).toEqual([]);
    expect(session.intent.scheduled).toBeUndefined();
  });

  test("replays a stored intent without counting or creating another task", async () => {
    const scheduled = {
      id: "schedule:task-1",
      conversationId: 1 as ScheduledInstruction["conversationId"],
      instruction: "Already set",
      runAt: Date.now() + 60_000,
    } satisfies ScheduledInstruction;
    const session = harness({ open: 50, intent: { scheduled } });
    const result = await tool.execute(
      { instruction: "Already set", delaySeconds: 30 },
      session.api,
      context,
    );
    expect(session.created).toEqual([]);
    expect(session.scans()).toBe(0);
    expect(result.details).toMatchObject({ id: "schedule:task-1" });
  });

  test("returns a committed intent without applying the cap when the snapshot missed it", async () => {
    const scheduled = {
      id: "schedule:task-1",
      conversationId: 1 as ScheduledInstruction["conversationId"],
      instruction: "Already set",
      runAt: Date.now() + 60_000,
    } satisfies ScheduledInstruction;
    const session = harness({
      open: 50,
      snapshotIntent: {},
      intent: { scheduled },
    });
    const result = await tool.execute(
      { instruction: "Already set", delaySeconds: 30 },
      session.api,
      context,
    );
    expect(session.created).toEqual([]);
    expect(session.scans()).toBe(0);
    expect(result.details).toMatchObject({ id: "schedule:task-1" });
  });

  test("rejects a recurrence shorter than the floor", async () => {
    const session = harness({ open: 0 });
    await expect(
      tool.execute(
        {
          instruction: "Every minute",
          delaySeconds: 60,
          recurrence: { cadence: { unit: "minute", interval: 1 }, timezone: "UTC" },
        },
        session.api,
        context,
      ),
    ).rejects.toThrow("15 minutes");
    expect(session.created).toEqual([]);
  });

  test("allows a successor while its source is still open, including a one-minute cadence", async () => {
    const session = harness({
      open: 1,
      deliveries: {
        active: [
          {
            scheduleId: "schedule:source",
            conversationId: 1,
            instruction: "Keep going",
            runAt: Date.now() - 60_000,
            recurrence: { cadence: { unit: "minute", interval: 1 }, timezone: "UTC" },
          },
        ],
      },
    });
    const result = await tool.execute(
      { instruction: "ignored", sourceScheduleId: "schedule:source" },
      session.api,
      context,
    );
    expect(session.created).toHaveLength(1);
    expect(session.deliveries.active[0]?.successor?.recurrence?.cadence).toEqual({
      unit: "minute",
      interval: 1,
    });
    expect(result.details).toMatchObject({ instruction: "Keep going" });
  });

  test("refuses a successor once the live count is already past the cap", async () => {
    const session = harness({
      open: 2,
      deliveries: {
        active: [
          {
            scheduleId: "schedule:source",
            conversationId: 1,
            instruction: "Keep going",
            runAt: Date.now() - 60_000,
            recurrence: { cadence: { unit: "hour", interval: 1 }, timezone: "UTC" },
          },
        ],
      },
    });
    await expect(
      tool.execute(
        { instruction: "ignored", sourceScheduleId: "schedule:source" },
        session.api,
        context,
      ),
    ).rejects.toThrow("1 routine");
    expect(session.created).toEqual([]);
    expect(session.deliveries.active[0]?.successor).toBeUndefined();
  });

  test("replays an existing successor without creating another task", async () => {
    const successor = {
      id: "schedule:next",
      conversationId: 1 as ScheduledInstruction["conversationId"],
      instruction: "Keep going",
      runAt: Date.now() + 60_000,
    } satisfies ScheduledInstruction;
    const session = harness({
      open: 20,
      deliveries: {
        active: [
          {
            scheduleId: "schedule:source",
            conversationId: 1,
            instruction: "Keep going",
            runAt: Date.now() - 60_000,
            recurrence: { cadence: { unit: "minute", interval: 1 }, timezone: "UTC" },
            successor,
          },
        ],
      },
    });
    const result = await tool.execute(
      { instruction: "ignored", sourceScheduleId: "schedule:source" },
      session.api,
      context,
    );
    expect(session.created).toEqual([]);
    expect(session.scans()).toBe(0);
    expect(result.details).toMatchObject({ id: "schedule:next" });
  });
});
