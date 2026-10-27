import { describe, expect, test } from "bun:test";
import type { Tx } from "@earendil-works/pi-durable";
import {
  commitDeliveryOutcome,
  nextRecurrenceRunAt,
  planNextInstruction,
  RECURRENCE_SEARCH_LIMIT,
  type ScheduleDelivery,
  type ScheduledInstruction,
} from "../src/schedule.ts";

const conversationId = 7 as ScheduledInstruction["conversationId"];
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

const minute = (interval: number) => ({
  cadence: { unit: "minute" as const, interval },
  timezone: "UTC",
});

const hour = (interval: number) => ({
  cadence: { unit: "hour" as const, interval },
  timezone: "UTC",
});

function delivery(overrides: Partial<ScheduleDelivery> = {}): ScheduleDelivery {
  return {
    scheduleId: "schedule:source",
    conversationId,
    instruction: "Send the briefing",
    name: "Briefing",
    runAt: Date.parse("2026-05-01T00:00:00.000Z"),
    recurrence: { cadence: { unit: "day", interval: 1 }, timezone: "UTC" },
    ...overrides,
  };
}

function input(runAt = Date.parse("2026-05-01T00:00:00.000Z")): ScheduledInstruction {
  return {
    id: "schedule:source",
    conversationId,
    instruction: "Send the briefing",
    name: "Briefing",
    runAt,
    recurrence: { cadence: { unit: "day", interval: 1 }, timezone: "UTC" },
  };
}

function localParts(timestamp: number, timeZone: string): Record<string, number> {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA-u-ca-iso8601-nu-latn", {
      timeZone,
      calendar: "iso8601",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(timestamp)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, Number(value)]),
  );
}

describe("nextRecurrenceRunAt", () => {
  test("steps minutes and hours on a fixed grid, strictly after now", () => {
    const start = Date.parse("2026-05-01T00:00:00.000Z");
    expect(nextRecurrenceRunAt(start, minute(15), start)).toBe(start + 15 * MINUTE_MS);
    expect(nextRecurrenceRunAt(start, minute(15), start + 15 * MINUTE_MS)).toBe(start + 30 * MINUTE_MS);
    expect(nextRecurrenceRunAt(start, minute(15), start + 20 * MINUTE_MS)).toBe(start + 30 * MINUTE_MS);
    expect(nextRecurrenceRunAt(start, minute(1), start + 90 * MINUTE_MS)).toBe(start + 91 * MINUTE_MS);

    expect(nextRecurrenceRunAt(start, hour(2), start)).toBe(start + 2 * HOUR_MS);
    expect(nextRecurrenceRunAt(start, hour(2), start + 4 * HOUR_MS)).toBe(start + 6 * HOUR_MS);
    expect(nextRecurrenceRunAt(start, hour(2), start + 5 * HOUR_MS)).toBe(start + 6 * HOUR_MS);
    expect(nextRecurrenceRunAt(start, hour(1), start)).toBe(start + HOUR_MS);
  });

  test("clamps a month-end day instead of spilling into the next month", () => {
    expect(
      nextRecurrenceRunAt(
        Date.parse("2026-01-31T09:00:00.000Z"),
        { cadence: { unit: "month", interval: 1 }, timezone: "UTC" },
        Date.parse("2026-01-31T09:00:00.000Z"),
      ),
    ).toBe(Date.parse("2026-02-28T09:00:00.000Z"));
    expect(
      nextRecurrenceRunAt(
        Date.parse("2024-01-31T00:00:00.000Z"),
        { cadence: { unit: "month", interval: 1 }, timezone: "UTC" },
        Date.parse("2024-01-31T00:00:00.000Z"),
      ),
    ).toBe(Date.parse("2024-02-29T00:00:00.000Z"));
    expect(
      nextRecurrenceRunAt(
        Date.parse("2026-03-31T12:00:00.000Z"),
        { cadence: { unit: "month", interval: 1 }, timezone: "UTC" },
        Date.parse("2026-03-31T12:00:00.000Z"),
      ),
    ).toBe(Date.parse("2026-04-30T12:00:00.000Z"));

    const previous = Date.parse("2026-01-31T23:30:00-05:00");
    const next = nextRecurrenceRunAt(
      previous,
      { cadence: { unit: "month", interval: 1 }, timezone: "America/New_York" },
      previous,
    );
    expect(localParts(next, "America/New_York")).toMatchObject({
      year: 2026,
      month: 2,
      day: 28,
      hour: 23,
      minute: 30,
    });
    expect(next).toBe(Date.parse("2026-02-28T23:30:00-05:00"));
  });

  test("moves a skipped spring-forward wall time forward by the gap", () => {
    const zone = "America/New_York";
    const previous = Date.parse("2026-03-07T02:30:00-05:00");
    const next = nextRecurrenceRunAt(
      previous,
      { cadence: { unit: "day", interval: 1 }, timezone: zone },
      previous,
    );
    expect(next).toBe(Date.parse("2026-03-08T03:30:00-04:00"));
    expect(localParts(next, zone)).toMatchObject({
      year: 2026,
      month: 3,
      day: 8,
      hour: 3,
      minute: 30,
    });
    expect(next - previous).toBe(24 * HOUR_MS);
  });

  test("stops a calendar search that exceeds the safety limit", () => {
    expect(RECURRENCE_SEARCH_LIMIT).toBe(1_000_000);
    const previous = Date.parse("2026-01-01T00:00:00.000Z");
    const daily = { cadence: { unit: "day" as const, interval: 1 }, timezone: "UTC" };
    expect(nextRecurrenceRunAt(previous, daily, previous, 3)).toBe(
      Date.parse("2026-01-02T00:00:00.000Z"),
    );
    expect(() =>
      nextRecurrenceRunAt(previous, daily, Date.parse("2026-02-01T00:00:00.000Z"), 3),
    ).toThrow("safety limit");
    const nearLimit = Number.MAX_SAFE_INTEGER - 1_000;
    expect(() => nextRecurrenceRunAt(nearLimit, minute(1), nearLimit)).toThrow("safe range");
  });
});

describe("planNextInstruction", () => {
  const now = Date.parse("2026-05-01T00:00:00.000Z");

  test("writes the next row from the active delivery when the run succeeded", () => {
    const active = delivery();
    const scheduled = planNextInstruction(active, now, true, "schedule:next");
    expect(scheduled).toEqual({
      id: "schedule:next",
      conversationId,
      instruction: "Send the briefing",
      name: "Briefing",
      runAt: Date.parse("2026-05-02T00:00:00.000Z"),
      recurrence: { cadence: { unit: "day", interval: 1 }, timezone: "UTC" },
    });
  });

  test("writes the next run after a failed turn, since the run itself settled", () => {
    const scheduled = planNextInstruction(delivery(), now, true, "schedule:next");
    expect(scheduled?.runAt).toBe(Date.parse("2026-05-02T00:00:00.000Z"));
  });

  test("does not write when a successor already exists, the run was aborted, or it does not recur", () => {
    const successor = {
      id: "schedule:model",
      conversationId,
      instruction: "Send the briefing",
      runAt: now + 86_400_000,
    } satisfies ScheduledInstruction;
    expect(
      planNextInstruction(delivery({ successor, runAt: Number.NaN }), now, true, "schedule:next"),
    ).toBeUndefined();
    expect(planNextInstruction(delivery(), now, false, "schedule:next")).toBeUndefined();
    expect(
      planNextInstruction(delivery({ recurrence: undefined }), now, true, "schedule:next"),
    ).toBeUndefined();
    expect(planNextInstruction(undefined, now, true, "schedule:next")).toBeUndefined();
  });
});

describe("commitDeliveryOutcome", () => {
  function harness(active: ScheduleDelivery[]) {
    const created: ScheduledInstruction[] = [];
    const deliveries = { active: [...active] };
    const tx = {
      doc: async () => deliveries,
      createTask: async (_task: unknown, scheduled: ScheduledInstruction) => {
        created.push(scheduled);
        return "created";
      },
    };
    return { tx: tx as unknown as Tx, created, deliveries };
  }

  test("creates the next instruction in the same commit that clears the delivery", async () => {
    const now = Date.parse("2026-05-01T00:00:00.000Z");
    const session = harness([delivery(), delivery({ scheduleId: "schedule:other" })]);
    const scheduled = await commitDeliveryOutcome(session.tx, input(), now, true, "schedule:next");
    if (scheduled === undefined) throw new Error("expected a successor");
    expect(session.created).toEqual([scheduled]);
    expect(scheduled.id).toBe("schedule:next");
    expect(scheduled.runAt).toBeGreaterThan(now);
    expect(session.deliveries.active.map((item) => item.scheduleId)).toEqual(["schedule:other"]);
  });

  test("keeps an in-flight sourceScheduleId successor and does not create a second task", async () => {
    const now = Date.parse("2026-05-01T00:00:00.000Z");
    const successor = {
      id: "schedule:model",
      conversationId,
      instruction: "Send the briefing",
      runAt: now + 86_400_000,
      recurrence: { cadence: { unit: "day" as const, interval: 1 }, timezone: "UTC" },
    } satisfies ScheduledInstruction;
    const session = harness([delivery({ successor })]);
    const scheduled = await commitDeliveryOutcome(session.tx, input(), now, true, "schedule:next");
    expect(scheduled).toBeUndefined();
    expect(session.created).toEqual([]);
    expect(session.deliveries.active).toEqual([]);
  });

  test("keeps the routine after a failed run, but not after an abort", async () => {
    const now = Date.parse("2026-05-01T00:00:00.000Z");
    const failed = harness([delivery()]);
    const next = await commitDeliveryOutcome(failed.tx, input(), now, true, "schedule:next");
    if (next === undefined) throw new Error("expected a successor after a failed run");
    expect(next.id).toBe("schedule:next");
    expect(failed.created).toEqual([next]);
    expect(failed.deliveries.active).toEqual([]);

    const aborted = harness([delivery()]);
    const scheduled = await commitDeliveryOutcome(aborted.tx, input(), now, false, "schedule:next");
    expect(scheduled).toBeUndefined();
    expect(aborted.created).toEqual([]);
    expect(aborted.deliveries.active).toEqual([]);
  });
});
