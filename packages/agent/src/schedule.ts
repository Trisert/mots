import {
  type ConversationId,
  defineDoc,
  defineTask,
  type TaskInspection,
  type Tx,
} from "@earendil-works/pi-durable";
import { formatScheduledInstruction, type SessionLocale } from "@mots/protocol";
import {
  PushTokenDoc,
  readStoredPushToken,
  sendReminderPush,
  sendRoutineStoppedPush,
} from "./push-token.ts";
import { LocaleDoc, readStoredLocale } from "./locale.ts";

export type ScheduleCadence = {
  readonly unit: "minute" | "hour" | "day" | "week" | "month";
  readonly interval: number;
};

export type ScheduleRecurrence = {
  readonly cadence: ScheduleCadence;
  /** IANA timezone used to interpret calendar recurrence, including daylight-saving transitions. */
  readonly timezone: string;
};

/** Durable input of one scheduled delivery. */
export type ScheduledInstruction = {
  readonly id: string;
  readonly conversationId: ConversationId;
  readonly instruction: string;
  readonly name?: string;
  /** Unix timestamp in milliseconds. */
  readonly runAt: number;
  readonly recurrence?: ScheduleRecurrence;
  /** Consecutive runs that did not complete. Omitted while the routine is healthy. */
  readonly failures?: number;
};

/** A recurring routine stops after this many runs in a row fail. */
export const MAX_CONSECUTIVE_FAILURES = 3;

type DeliveryState = { phase: "wait" } | { phase: "deliver" };

type LocalDateTime = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly millisecond: number;
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
/** Calendar recurrence stops after this many steps instead of searching forever. */
export const RECURRENCE_SEARCH_LIMIT = 1_000_000;
const localFormatters = new Map<string, Intl.DateTimeFormat>();

const localFormatter = (timezone: string): Intl.DateTimeFormat => {
  let formatter = localFormatters.get(timezone);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat("en-CA-u-ca-iso8601-nu-latn", {
      timeZone: timezone,
      calendar: "iso8601",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    localFormatters.set(timezone, formatter);
  }
  return formatter;
};

const localDateTime = (timestamp: number, timezone: string): LocalDateTime => {
  const fields = Object.fromEntries(
    localFormatter(timezone)
      .formatToParts(timestamp)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, Number(value)]),
  );
  return {
    year: fields.year!,
    month: fields.month!,
    day: fields.day!,
    hour: fields.hour!,
    minute: fields.minute!,
    second: fields.second!,
    millisecond: ((timestamp % 1_000) + 1_000) % 1_000,
  };
};

const localEpoch = (value: LocalDateTime): number =>
  Date.UTC(
    value.year,
    value.month - 1,
    value.day,
    value.hour,
    value.minute,
    value.second,
    value.millisecond,
  );

const sameLocalDateTime = (left: LocalDateTime, right: LocalDateTime): boolean =>
  left.year === right.year &&
  left.month === right.month &&
  left.day === right.day &&
  left.hour === right.hour &&
  left.minute === right.minute &&
  left.second === right.second &&
  left.millisecond === right.millisecond;

/** Resolve a local wall-clock time using Temporal-compatible DST disambiguation. */
const localDateTimeToEpoch = (value: LocalDateTime, timezone: string): number => {
  const target = localEpoch(value);
  const offsets = new Set<number>();
  for (const distance of [-2 * DAY_MS, -DAY_MS, 0, DAY_MS, 2 * DAY_MS]) {
    const sample = target + distance;
    offsets.add(localEpoch(localDateTime(sample, timezone)) - sample);
  }
  const candidates = [...offsets].map((offset) => target - offset);
  const exact = candidates
    .filter((candidate) => sameLocalDateTime(localDateTime(candidate, timezone), value))
    .sort((left, right) => left - right);
  if (exact.length > 0) return exact[0]!;

  // A skipped spring-forward time moves ahead by the size of the timezone gap.
  const shifted = candidates
    .map((candidate) => ({
      candidate,
      wallClockDelta: localEpoch(localDateTime(candidate, timezone)) - target,
    }))
    .filter(({ wallClockDelta }) => wallClockDelta > 0)
    .sort(
      (left, right) =>
        left.wallClockDelta - right.wallClockDelta || left.candidate - right.candidate,
    );
  if (shifted.length === 0) {
    throw new Error(`Cannot resolve local recurrence deadline in ${timezone}`);
  }
  return shifted[0]!.candidate;
};

const addDays = (value: LocalDateTime, days: number): LocalDateTime => {
  const date = new Date(
    Date.UTC(
      value.year,
      value.month - 1,
      value.day + days,
      value.hour,
      value.minute,
      value.second,
      value.millisecond,
    ),
  );
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
    millisecond: date.getUTCMilliseconds(),
  };
};

const addMonths = (value: LocalDateTime, months: number): LocalDateTime => {
  const monthIndex = value.year * 12 + value.month - 1 + months;
  const year = Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { ...value, year, month, day: Math.min(value.day, lastDay) };
};

/**
 * First recurrence deadline after `now`, advanced from the previous scheduled deadline.
 * Minute and hour cadences are fixed durations. Day, week, and month cadences follow
 * the timezone wall clock. A calendar search throws after `maxAttempts` steps.
 */
export function nextRecurrenceRunAt(
  previousRunAt: number,
  recurrence: ScheduleRecurrence,
  now: number,
  maxAttempts = RECURRENCE_SEARCH_LIMIT,
): number {
  const { interval, unit } = recurrence.cadence;
  if (!Number.isSafeInteger(interval) || interval < 1) {
    throw new Error("recurrence cadence interval must be a positive integer");
  }
  if (unit === "minute" || unit === "hour") {
    const duration = interval * (unit === "minute" ? MINUTE_MS : HOUR_MS);
    const occurrences = Math.max(1, Math.floor((now - previousRunAt) / duration) + 1);
    const next = previousRunAt + occurrences * duration;
    if (!Number.isSafeInteger(next))
      throw new Error("recurrence deadline is outside the safe range");
    return next;
  }

  let local = localDateTime(previousRunAt, recurrence.timezone);
  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    local =
      unit === "month"
        ? addMonths(local, interval)
        : addDays(local, interval * (unit === "week" ? 7 : 1));
    const next = localDateTimeToEpoch(local, recurrence.timezone);
    if (next > now) return next;
    // Continue from the resolved instant so catch-up follows the same sequence as materialized runs.
    local = localDateTime(next, recurrence.timezone);
  }
  throw new Error("recurrence deadline search exceeded its safety limit");
}

/** One active delivery. `successor` is set when `schedule` already wrote the next run. */
export type ScheduleDelivery = {
  scheduleId: string;
  conversationId: ConversationId;
  instruction: string;
  name?: string;
  runAt: number;
  recurrence?: ScheduleRecurrence;
  failures?: number;
  successor?: ScheduledInstruction;
};

/**
 * The next row a finished delivery writes, or `undefined` when this settlement
 * must not create one. `settled` means the run ended on its own, whether the
 * turn succeeded, failed, or threw. An aborted run passes `false`. `failed`
 * counts toward `MAX_CONSECUTIVE_FAILURES`. A stored successor means an
 * in-flight `sourceScheduleId` call already created the task.
 */
export function planNextInstruction(
  delivery: ScheduleDelivery | undefined,
  now: number,
  settled: boolean,
  nextId: string,
  failed = false,
): ScheduledInstruction | undefined {
  if (!settled || delivery === undefined) return undefined;
  if (delivery.successor !== undefined || delivery.recurrence === undefined) return undefined;
  const failures = failed ? (delivery.failures ?? 0) + 1 : 0;
  if (failures >= MAX_CONSECUTIVE_FAILURES) return undefined;
  const recurrence: ScheduleRecurrence = {
    cadence: {
      unit: delivery.recurrence.cadence.unit,
      interval: delivery.recurrence.cadence.interval,
    },
    timezone: delivery.recurrence.timezone,
  };
  const runAt = nextRecurrenceRunAt(delivery.runAt, recurrence, now);
  return {
    id: nextId,
    conversationId: delivery.conversationId,
    instruction: delivery.instruction,
    ...(delivery.name === undefined ? {} : { name: delivery.name }),
    runAt,
    recurrence,
    ...(failures === 0 ? {} : { failures }),
  };
}

/** Deliveries currently running, so `schedule` can reject accidental recursion. */
export const ScheduleDeliveries = defineDoc<{
  active: ScheduleDelivery[];
}>({
  kind: "app.schedule-deliveries",
  version: 1,
  scope: "session",
  initial: () => ({ active: [] }),
});

/**
 * The exported handle is for `createTask` and kind lookups; the harness registers the instance
 * built with the Worker's token.
 */
export function createDeliverScheduledInstruction(options: {
  readonly expoAccessToken?: string;
} = {}) {
  return defineTask<ScheduledInstruction, DeliveryState, null>({
    name: "app.deliver-scheduled-instruction",
    version: 1,
    initial: () => ({ phase: "wait" }),
    phases: {
      wait: async (task, runtime, context) => {
        await runtime.sleep(task.input.runAt, context);
        await runtime.commit(async (tx) => {
          const deliveries = await tx.doc(ScheduleDeliveries);
          if (!deliveries.active.some(({ scheduleId }) => scheduleId === task.input.id)) {
            deliveries.active.push({
              scheduleId: task.input.id,
              conversationId: task.input.conversationId,
              instruction: task.input.instruction,
              name: task.input.name,
              runAt: task.input.runAt,
              ...(task.input.recurrence === undefined ? {} : { recurrence: task.input.recurrence }),
              ...(task.input.failures === undefined ? {} : { failures: task.input.failures }),
            });
          }
          return { status: "running", checkpoint: { phase: "deliver" } };
        }, context);
      },
      deliver: async (task, runtime, context) => {
        let delivered = false;
        // True once the turn has settled (done or failed), or the run has thrown.
        let ended = false;
        // A missing or unreadable language falls back to English. It never blocks the push.
        const pushLocale = async (): Promise<SessionLocale | undefined> => {
          try {
            return readStoredLocale(await runtime.snapshot(LocaleDoc, context));
          } catch {
            return undefined;
          }
        };
        const notifyStopped = async (): Promise<void> => {
          try {
            const stored = await runtime.snapshot(PushTokenDoc, context);
            const token = readStoredPushToken(stored);
            if (token !== undefined) {
              await sendRoutineStoppedPush(
                task.input,
                token,
                await pushLocale(),
                options.expoAccessToken,
              );
            }
          } catch (error) {
            try {
              runtime.report(error);
            } catch {
              // Reporting must not change the outcome either.
            }
          }
        };
        // The run that brings the failure count to the limit stops the routine.
        const stopsRoutine =
          task.input.recurrence !== undefined &&
          (task.input.failures ?? 0) + 1 >= MAX_CONSECUTIVE_FAILURES;
        try {
          const conversation = await runtime.conversation(task.input.conversationId, context);
          if (conversation !== undefined) {
            const submission = await conversation.submit(
              {
                type: "input",
                content: formatScheduledInstruction(task.input),
                requestId: task.input.id,
                whenBusy: "followUp",
              },
              context,
            );
            const turn = await submission.wait(context);
            delivered = turn.status === "done";
            // A user abort withdraws the input, and that stops the routine. Any other
            // unanswered turn is a failure, and the routine goes on.
            ended = turn.status === "done" || turn.reason !== "aborted";
            if (turn.status !== "done") {
              // The next run is still scheduled, so report the miss instead of
              // letting a failing routine repeat silently.
              try {
                runtime.report(
                  new Error(
                    `Scheduled instruction ${task.input.id} did not complete (${turn.status}${turn.reason === undefined ? "" : `: ${turn.reason}`})`,
                  ),
                );
              } catch {
                // Reporting must not skip the next row either.
              }
            }
          } else {
            runtime.report(
              new Error(
                `Scheduled instruction ${task.input.id} conversation ${task.input.conversationId} is missing`,
              ),
            );
          }
          // The turn is already in the conversation. A push failure must not
          // change `delivered`, or the next recurrence row is skipped.
          if (delivered) {
            try {
              const stored = await runtime.snapshot(PushTokenDoc, context);
              const token = readStoredPushToken(stored);
              if (token !== undefined) {
                await sendReminderPush(
                  task.input,
                  token,
                  await pushLocale(),
                  options.expoAccessToken,
                );
              }
            } catch (error) {
              try {
                runtime.report(error);
              } catch {
                // Reporting the push failure must not skip the next row either.
              }
            }
          }
          await runtime.commit(async (tx) => {
            await commitDeliveryOutcome(tx, task.input, runtime.now(), ended, undefined, !delivered);
            return { status: "terminal", outcome: { status: "completed", result: null } };
          }, context);
          if (ended && !delivered && stopsRoutine) await notifyStopped();
        } catch (error) {
          // An uncaught error faults the task, which is terminal. Write the next row
          // in this commit first, so one thrown run does not end the routine.
          await runtime.commit(async (tx) => {
            await commitDeliveryOutcome(tx, task.input, runtime.now(), true, undefined, true);
            return { status: "running", checkpoint: { phase: "deliver" } };
          }, context);
          if (stopsRoutine) await notifyStopped();
          throw error;
        }
      },
    },
    abort: async (task, runtime, context) => {
      await runtime.commit(async (tx) => {
        await commitDeliveryOutcome(tx, task.input, runtime.now(), false);
        return { status: "terminal", outcome: { status: "aborted" } };
      }, context);
    },
  });
}

export const DeliverScheduledInstruction = createDeliverScheduledInstruction();

/**
 * Like `planNextInstruction`, but a recurrence that cannot be planned stops the
 * routine instead of failing the commit. A failing commit would keep the active
 * delivery and block the conversation's `schedule` calls.
 */
const planOrStop = (
  delivery: ScheduleDelivery | undefined,
  now: number,
  settled: boolean,
  nextId: string,
  failed: boolean,
): ScheduledInstruction | undefined => {
  try {
    return planNextInstruction(delivery, now, settled, nextId, failed);
  } catch {
    return undefined;
  }
};

/**
 * Clear the active delivery and write its next row in that same commit.
 * Pass `settled: true` for a run that finished on its own, including a failed
 * turn, so a routine survives one bad run. Aborted runs pass `settled: false`.
 */
export async function commitDeliveryOutcome(
  tx: Tx,
  input: ScheduledInstruction,
  now: number,
  settled: boolean,
  nextId = `schedule:${crypto.randomUUID()}`,
  failed = false,
): Promise<ScheduledInstruction | undefined> {
  const deliveries = await tx.doc(ScheduleDeliveries);
  const delivery = deliveries.active.find((item) => item.scheduleId === input.id);
  // Clear the active entry first, so no planning failure can leave it behind.
  // That entry would block every later `schedule` call in the conversation.
  removeDelivery(deliveries, input.id);
  const scheduled = planOrStop(delivery, now, settled, nextId, failed);
  if (scheduled !== undefined) {
    await tx.createTask(DeliverScheduledInstruction, scheduled, {
      ownership: { kind: "conversation" },
      conversationId: scheduled.conversationId,
      background: true,
    });
  }
  return scheduled;
}

const removeDelivery = (
  deliveries: { active: Array<{ scheduleId: string }> },
  scheduleId: string,
): void => {
  const index = deliveries.active.findIndex((delivery) => delivery.scheduleId === scheduleId);
  if (index !== -1) deliveries.active.splice(index, 1);
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Deadline of a delivery task that is still waiting, or `undefined` for other tasks. */
export function scheduledDeadline(task: TaskInspection): number | undefined {
  if (task.record.kind !== DeliverScheduledInstruction.definition.name) return undefined;
  if (task.record.state.status === "completing" || task.record.state.status === "terminal") {
    return undefined;
  }
  if (!isRecord(task.record.input) || !isRecord(task.record.state.checkpoint)) {
    throw new Error(`Scheduled instruction task ${task.record.id} has invalid durable state`);
  }
  const runAt = task.record.input.runAt;
  if (!Number.isSafeInteger(runAt) || (runAt as number) < 0) {
    throw new Error(`Scheduled instruction task ${task.record.id} has an invalid runAt`);
  }
  const phase = task.record.state.checkpoint.phase;
  if (phase === "wait") return runAt as number;
  if (phase === "deliver") return undefined;
  throw new Error(`Scheduled instruction task ${task.record.id} has an invalid phase`);
}
