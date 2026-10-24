import { Type } from "@earendil-works/pi-ai";
import { defineDoc, type ToolRegistration } from "@earendil-works/pi-durable";
import {
  DeliverScheduledInstruction,
  nextRecurrenceRunAt,
  type ScheduleRecurrence,
  type ScheduledInstruction,
  ScheduleDeliveries,
} from "./schedule.ts";
import { MAX_PROMPT_CHARACTERS } from "@mots/protocol";

export const SCHEDULE_TOOL_NAME = "schedule";

const MAX_DELAY_SECONDS = 366 * 24 * 60 * 60;
const TIMEZONE_SUFFIX = /(?:Z|[+-]\d{2}:\d{2})$/i;

/** The schedule a tool task created, so a safe replay returns it instead of creating another. */
const ScheduleIntent = defineDoc<{ scheduled?: ScheduledInstruction }>({
  kind: "app.schedule-intent",
  version: 1,
  scope: "task",
  initial: () => ({}),
});

type ScheduleArguments = {
  readonly instruction: string;
  readonly name?: string;
  readonly delaySeconds?: number;
  readonly at?: string;
  readonly recurrence?: ScheduleRecurrence;
  readonly sourceScheduleId?: string;
};

function resolveRunAt({ delaySeconds, at }: ScheduleArguments, now: number): number {
  if ((delaySeconds === undefined) === (at === undefined)) {
    throw new Error("Provide exactly one of delaySeconds or at");
  }
  if (delaySeconds !== undefined) return now + delaySeconds * 1000;
  const runAt = TIMEZONE_SUFFIX.test(at!) ? Date.parse(at!) : Number.NaN;
  if (!Number.isFinite(runAt)) {
    throw new Error("at must be an ISO 8601 date-time with a timezone offset");
  }
  if (runAt <= now) throw new Error("at must be in the future");
  if (runAt > now + MAX_DELAY_SECONDS * 1000) throw new Error("at is too far in the future");
  return runAt;
}

function validateRecurrence(
  recurrence: ScheduleRecurrence | undefined,
): ScheduleRecurrence | undefined {
  if (recurrence === undefined) return undefined;
  try {
    new Intl.DateTimeFormat("en", { timeZone: recurrence.timezone }).format(0);
  } catch (error) {
    throw new Error("recurrence.timezone must be a valid IANA timezone", { cause: error });
  }
  return recurrence;
}

function copyScheduledInstruction(scheduled: ScheduledInstruction): ScheduledInstruction {
  return {
    id: scheduled.id,
    conversationId: scheduled.conversationId,
    instruction: scheduled.instruction,
    name: scheduled.name,
    runAt: scheduled.runAt,
    ...(scheduled.recurrence === undefined
      ? {}
      : {
          recurrence: {
            cadence: {
              unit: scheduled.recurrence.cadence.unit,
              interval: scheduled.recurrence.cadence.interval,
            },
            timezone: scheduled.recurrence.timezone,
          },
        }),
  };
}

const scheduleResult = (scheduled: ScheduledInstruction, now: number) => {
  const runAt = new Date(scheduled.runAt).toISOString();
  const seconds = Math.max(0, Math.round((scheduled.runAt - now) / 1000));
  const label = scheduled.name ? `Routine "${scheduled.name}"` : "Scheduled";
  return {
    output: [
      {
        type: "text" as const,
        text: `${label} set. At ${runAt} (in ${seconds} seconds) this conversation will autonomously receive: ${JSON.stringify(scheduled.instruction)}. Nothing further is needed now.`,
      },
    ],
    details: {
      id: scheduled.id,
      name: scheduled.name ?? "Routine autonoma",
      instruction: scheduled.instruction,
      runAt,
      ...(scheduled.recurrence === undefined ? {} : { recurrence: scheduled.recurrence }),
    },
  };
};

export function createScheduleTool(
  ensureWakeupAt: (timestamp: number) => Promise<void>,
): ToolRegistration {
  return {
    name: SCHEDULE_TOOL_NAME,
    description:
      "Schedule an autonomous routine, cronjob, or recurring task to be delivered to this conversation at a later time or on a recurring cadence. When the routine fires, the model resumes in this conversation with the instruction, reasons through it, executes tools, and reports back. Use this whenever the user wants scheduled briefings, periodic checks, recurring summaries, or delayed actions.",
    parameters: Type.Object({
      instruction: Type.String({
        minLength: 1,
        maxLength: MAX_PROMPT_CHARACTERS,
        description:
          "What to execute when the routine fires, phrased as a self-contained autonomous directive, e.g. 'Synthesize today's schedule and check weather' or 'Review unread notifications'",
      }),
      name: Type.Optional(
        Type.String({
          maxLength: 80,
          description:
            "Human-readable title for this autonomous routine, e.g. 'Briefing mattutino' or 'Pulizia serale'",
        }),
      ),
      delaySeconds: Type.Optional(
        Type.Integer({
          minimum: 1,
          maximum: MAX_DELAY_SECONDS,
          description:
            "Run after this many seconds. Use for relative times such as 'in 10 minutes'",
        }),
      ),
      at: Type.Optional(
        Type.String({
          description:
            "Run at this ISO 8601 date-time with a timezone offset, e.g. 2026-10-01T09:00:00+02:00. Use for absolute times; provide exactly one of delaySeconds or at",
        }),
      ),
      recurrence: Type.Optional(
        Type.Object({
          cadence: Type.Object({
            unit: Type.Union([
              Type.Literal("minute"),
              Type.Literal("hour"),
              Type.Literal("day"),
              Type.Literal("week"),
              Type.Literal("month"),
            ]),
            interval: Type.Integer({ minimum: 1, maximum: 10_000 }),
          }),
          timezone: Type.String({
            minLength: 1,
            maxLength: 100,
            description: "IANA timezone, e.g. Europe/Vienna or America/New_York",
          }),
        }),
      ),
      sourceScheduleId: Type.Optional(
        Type.String({
          description:
            "When scheduling the next occurrence of a recurring instruction, the schedule ID given in its delivery. Omit delaySeconds, at, and recurrence because the source determines them",
        }),
      ),
    }),
    replay: "safe",
    execute: async (args: ScheduleArguments, api, context) => {
      const existing = (await api.snapshot(ScheduleIntent, api.taskId, context))?.scheduled;
      if (existing !== undefined) {
        await ensureWakeupAt(existing.runAt);
        return scheduleResult(existing, Date.now());
      }

      const now = Date.now();
      let persisted: ScheduledInstruction;
      if (args.sourceScheduleId !== undefined) {
        if (
          args.delaySeconds !== undefined ||
          args.at !== undefined ||
          args.recurrence !== undefined
        ) {
          throw new Error(
            "A recurring successor derives its deadline and recurrence from sourceScheduleId; omit delaySeconds, at, and recurrence",
          );
        }
        persisted = await api.commit(async (tx) => {
          const deliveries = await tx.doc(ScheduleDeliveries);
          const source = deliveries.active.find(
            (delivery) =>
              delivery.conversationId === api.conversationId &&
              delivery.scheduleId === args.sourceScheduleId,
          );
          if (source === undefined) {
            throw new Error("sourceScheduleId does not identify an active scheduled delivery");
          }
          if (source.recurrence === undefined) {
            throw new Error("the source schedule has no structured recurrence policy");
          }
          if (source.successor !== undefined) return copyScheduledInstruction(source.successor);
          const sourceRecurrence: ScheduleRecurrence = {
            cadence: {
              unit: source.recurrence.cadence.unit,
              interval: source.recurrence.cadence.interval,
            },
            timezone: source.recurrence.timezone,
          };
          const scheduled: ScheduledInstruction = {
            id: `schedule:${api.taskId}`,
            conversationId: api.conversationId,
            instruction: source.instruction,
            name: source.name,
            runAt: nextRecurrenceRunAt(source.runAt, sourceRecurrence, now),
            recurrence: sourceRecurrence,
          };
          source.successor = scheduled;
          await tx.createTask(DeliverScheduledInstruction, scheduled, {
            ownership: { kind: "conversation" },
            conversationId: api.conversationId,
            background: true,
          });
          return scheduled;
        }, context);
      } else {
        const recurrence = validateRecurrence(args.recurrence);
        const requested: ScheduledInstruction = {
          id: `schedule:${api.taskId}`,
          conversationId: api.conversationId,
          instruction: args.instruction,
          name: args.name,
          runAt: resolveRunAt(args, now),
          ...(recurrence === undefined ? {} : { recurrence }),
        };
        const deliveries = await api.snapshot(ScheduleDeliveries, context);
        if (
          deliveries?.active.some(({ conversationId }) => conversationId === api.conversationId) ===
          true
        ) {
          throw new Error(
            "schedule may run during a scheduled delivery only to create its recurring successor",
          );
        }
        persisted = await api.commit(async (tx) => {
          const intent = await tx.doc(ScheduleIntent, api.taskId);
          if (intent.scheduled !== undefined) return intent.scheduled;
          intent.scheduled = requested;
          await tx.createTask(DeliverScheduledInstruction, requested, {
            ownership: { kind: "conversation" },
            conversationId: api.conversationId,
            background: true,
          });
          return requested;
        }, context);
      }
      await ensureWakeupAt(persisted.runAt);
      return scheduleResult(persisted, now);
    },
  };
}
