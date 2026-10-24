import { describe, expect, test } from "bun:test";
import type { Cursor } from "@earendil-works/pi-durable";
import {
  assertRecurrenceAllowed,
  assertScheduleCapacity,
  countOpenScheduleTasks,
  DEFAULT_MAX_ACTIVE_SCHEDULES,
  DEFAULT_MIN_RECURRENCE_MS,
  recurrenceIntervalMs,
  scheduleLimitsFromEnv,
} from "../src/schedule-limits.ts";

const minute = (interval: number) => ({
  cadence: { unit: "minute" as const, interval },
  timezone: "UTC",
});

describe("scheduleLimitsFromEnv", () => {
  test("uses the defaults when the environment is empty or invalid", () => {
    expect(scheduleLimitsFromEnv(undefined)).toEqual({
      maxActive: DEFAULT_MAX_ACTIVE_SCHEDULES,
      minRecurrenceMs: DEFAULT_MIN_RECURRENCE_MS,
    });
    expect(
      scheduleLimitsFromEnv({
        MOTS_MAX_SCHEDULES: "0",
        MOTS_MIN_RECURRENCE_SECONDS: "1",
      }),
    ).toEqual({
      maxActive: DEFAULT_MAX_ACTIVE_SCHEDULES,
      minRecurrenceMs: DEFAULT_MIN_RECURRENCE_MS,
    });
    expect(scheduleLimitsFromEnv({ MOTS_MAX_SCHEDULES: "nope" }).maxActive).toBe(
      DEFAULT_MAX_ACTIVE_SCHEDULES,
    );
  });

  test("accepts values inside the safe bounds", () => {
    expect(
      scheduleLimitsFromEnv({
        MOTS_MAX_SCHEDULES: "3",
        MOTS_MIN_RECURRENCE_SECONDS: "60",
      }),
    ).toEqual({ maxActive: 3, minRecurrenceMs: 60_000 });
  });
});

describe("recurrence cadence", () => {
  test("treats a month as 28 days so it cannot sneak under the floor", () => {
    expect(recurrenceIntervalMs({ unit: "month", interval: 1 })).toBe(28 * 24 * 60 * 60 * 1000);
    expect(recurrenceIntervalMs({ unit: "minute", interval: 15 })).toBe(15 * 60 * 1000);
  });

  test("rejects a cadence shorter than the floor and allows a monthly one", () => {
    const limits = scheduleLimitsFromEnv(undefined);
    expect(() => assertRecurrenceAllowed(minute(1), limits)).toThrow("15 minutes");
    expect(() => assertRecurrenceAllowed(minute(14), limits)).toThrow("15 minutes");
    expect(() => assertRecurrenceAllowed(minute(15), limits)).not.toThrow();
    expect(() =>
      assertRecurrenceAllowed(
        { cadence: { unit: "month", interval: 1 }, timezone: "Europe/Vienna" },
        limits,
      ),
    ).not.toThrow();
    expect(() => assertRecurrenceAllowed(undefined, limits)).not.toThrow();
  });
});

describe("countOpenScheduleTasks", () => {
  test("counts live and completing tasks and pages until the cursor ends", async () => {
    const pages = [
      {
        items: Array.from({ length: 100 }, () => ({ state: { status: "waiting" } })),
        next: { page: 1 } satisfies Cursor,
      },
      {
        items: [{ state: { status: "completing" } }, { state: { status: "terminal" } }],
      },
    ];
    const open = await countOpenScheduleTasks({
      scanTasks: async (_query, limit, cursor) => {
        expect(limit).toBe(100);
        expect(_query.kind).toBe("app.deliver-scheduled-instruction");
        return cursor === undefined ? pages[0]! : pages[1]!;
      },
    });
    expect(open).toBe(101);
  });

  test("fails closed when the scan repeats a cursor", async () => {
    await expect(
      countOpenScheduleTasks({
        scanTasks: async () => ({
          items: [{ state: { status: "waiting" } }],
          next: { page: 1 },
        }),
      }),
    ).rejects.toThrow("did not advance");
  });
});

describe("assertScheduleCapacity", () => {
  const limits = { maxActive: 2, minRecurrenceMs: DEFAULT_MIN_RECURRENCE_MS };
  const scan = (open: number) => ({
    scanTasks: async () => ({
      items: Array.from({ length: open }, () => ({ state: { status: "running" } })),
    }),
  });

  test("requires a free slot for a new routine and one extra for a successor", async () => {
    await expect(assertScheduleCapacity(scan(1), limits, false)).resolves.toBeUndefined();
    await expect(assertScheduleCapacity(scan(2), limits, false)).rejects.toThrow("2");
    await expect(assertScheduleCapacity(scan(2), limits, true)).resolves.toBeUndefined();
    await expect(assertScheduleCapacity(scan(3), limits, true)).rejects.toThrow("2");
  });
});
