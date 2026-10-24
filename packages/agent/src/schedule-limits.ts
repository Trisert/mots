import type { Cursor, TaskQuery } from "@earendil-works/pi-durable";
import type { MotsEnvironment } from "./provider.ts";
import { DeliverScheduledInstruction, type ScheduleCadence, type ScheduleRecurrence } from "./schedule.ts";

export const DEFAULT_MAX_ACTIVE_SCHEDULES = 8;
export const DEFAULT_MIN_RECURRENCE_MS = 15 * 60 * 1000;

const MIN_RECURRENCE_FLOOR_SECONDS = 60;
const MAX_RECURRENCE_SECONDS = 86_400;
const MAX_ACTIVE_CEILING = 100;
const PAGE_SIZE = 100;
const MAX_PAGES = 20;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
/** 28 days, so a monthly cadence is never treated as shorter than the floor. */
const MONTH_MS = 28 * DAY_MS;

export type ScheduleLimits = {
  readonly maxActive: number;
  readonly minRecurrenceMs: number;
};

type ScheduleTaskScan = {
  scanTasks(
    query: TaskQuery,
    limit: number,
    cursor?: Cursor,
  ): Promise<{
    readonly items: readonly { readonly state: { readonly status: string } }[];
    readonly next?: Cursor;
  }>;
};

function boundedInt(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined || value.trim().length === 0) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

/** Invalid or empty values fall back to the defaults. They never open the cap. */
export function scheduleLimitsFromEnv(env: MotsEnvironment | undefined): ScheduleLimits {
  const source = env ?? {};
  return {
    maxActive: boundedInt(
      source.MOTS_MAX_SCHEDULES,
      DEFAULT_MAX_ACTIVE_SCHEDULES,
      1,
      MAX_ACTIVE_CEILING,
    ),
    minRecurrenceMs:
      boundedInt(
        source.MOTS_MIN_RECURRENCE_SECONDS,
        DEFAULT_MIN_RECURRENCE_MS / 1000,
        MIN_RECURRENCE_FLOOR_SECONDS,
        MAX_RECURRENCE_SECONDS,
      ) * 1000,
  };
}

export function recurrenceIntervalMs(cadence: ScheduleCadence): number {
  const unitMs =
    cadence.unit === "minute"
      ? MINUTE_MS
      : cadence.unit === "hour"
        ? HOUR_MS
        : cadence.unit === "day"
          ? DAY_MS
          : cadence.unit === "week"
            ? WEEK_MS
            : MONTH_MS;
  return cadence.interval * unitMs;
}

export function apartLabel(minRecurrenceMs: number): string {
  if (minRecurrenceMs % MINUTE_MS === 0) {
    const minutes = minRecurrenceMs / MINUTE_MS;
    return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  }
  const seconds = minRecurrenceMs / 1000;
  return seconds === 1 ? "1 second" : `${seconds} seconds`;
}

/** One-shots are not checked. A successor keeps the cadence it was created with. */
export function assertRecurrenceAllowed(
  recurrence: ScheduleRecurrence | undefined,
  limits: ScheduleLimits,
): void {
  if (recurrence === undefined) return;
  if (recurrenceIntervalMs(recurrence.cadence) >= limits.minRecurrenceMs) return;
  throw new Error(`Recurrence must be at least ${apartLabel(limits.minRecurrenceMs)} apart.`);
}

/**
 * Count non-terminal `app.deliver-scheduled-instruction` tasks.
 * `completing` still counts: the routine has not finished. A scan that does not finish throws,
 * so a full task list cannot be mistaken for a short one.
 */
export async function countOpenScheduleTasks(tx: ScheduleTaskScan): Promise<number> {
  let count = 0;
  let cursor: Cursor | undefined;
  const seen = new Set<string>();
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await tx.scanTasks(
      { kind: DeliverScheduledInstruction.definition.name },
      PAGE_SIZE,
      cursor,
    );
    for (const task of result.items) {
      if (task.state.status !== "terminal") count += 1;
    }
    if (result.next === undefined) return count;
    const key = JSON.stringify(result.next);
    if (seen.has(key)) throw new Error("Scheduled task scan did not advance");
    seen.add(key);
    cursor = result.next;
  }
  throw new Error("Too many scheduled tasks to count");
}

/**
 * A new routine needs a free slot. A successor is allowed while its source is still open,
 * so the live count may briefly be `maxActive + 1`.
 */
export async function assertScheduleCapacity(
  tx: ScheduleTaskScan,
  limits: ScheduleLimits,
  successor: boolean,
): Promise<void> {
  const open = await countOpenScheduleTasks(tx);
  const allowed = successor ? open <= limits.maxActive : open < limits.maxActive;
  if (allowed) return;
  const noun = limits.maxActive === 1 ? "routine" : "routines";
  throw new Error(`At most ${limits.maxActive} ${noun} can be active at once.`);
}
