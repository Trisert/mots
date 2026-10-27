import type {
  AgentEvent,
  InboxState,
  TaskGraph,
  TaskGraphNode,
  TaskGraphState,
} from "@earendil-works/pi-durable";

export {
  COMMAND_ERROR,
  HTTP_ERROR,
  parseSessionCapability,
  SESSION_CAPABILITY_PATTERN,
  type SessionCapability,
} from "./session-capability.ts";
export {
  MAX_CATALOG_MODELS,
  parseModelCatalog,
  type ModelCatalogEntry,
  type ModelCatalogProvider,
  type ModelCatalogResponse,
} from "./model-catalog.ts";

export const ROOT_CONVERSATION_ID = 1;
export const MAX_PROMPT_CHARACTERS = 100_000;
export const MAX_REQUEST_ID_CHARACTERS = 256;
// Expo push tokens (`ExponentPushToken[...]`, `ExpoPushToken[...]`, or a legacy UUID).
export const MAX_PUSH_TOKEN_CHARACTERS = 256;
export const MAX_TIMEZONE_CHARACTERS = 100;
/** Languages the app can show. The agent replies in the chosen one. */
export const SESSION_LOCALES = ["en", "it"] as const;
export type SessionLocale = (typeof SESSION_LOCALES)[number];
// JSON may escape each prompt code unit as six characters.
export const MAX_CLIENT_FRAME_CHARACTERS =
  MAX_PROMPT_CHARACTERS * 6 + MAX_REQUEST_ID_CHARACTERS + 1024;
const SCHEDULED_INSTRUCTION_PREFIX = "Scheduled instruction due now: ";
const RECURRENCE_NOTE_PREFIX = "\n\nThis instruction recurs.";

/** Input submitted when a scheduled instruction is due. Self-contained; no system-prompt support needed. */
export function formatScheduledInstruction(scheduled: {
  readonly id: string;
  readonly instruction: string;
  readonly name?: string;
  readonly recurrence?: {
    readonly cadence: {
      readonly unit: "minute" | "hour" | "day" | "week" | "month";
      readonly interval: number;
    };
    readonly timezone: string;
  };
}): string {
  const prefix = scheduled.name ? `Autonomous routine [${scheduled.name}] due now: ` : SCHEDULED_INSTRUCTION_PREFIX;
  const text = `${prefix}${scheduled.instruction}`;
  if (scheduled.recurrence === undefined) return text;
  const { interval, unit } = scheduled.recurrence.cadence;
  const cadence = `${interval} ${unit}${interval === 1 ? "" : "s"}`;
  return `${text}${RECURRENCE_NOTE_PREFIX} It repeats every ${cadence} in ${scheduled.recurrence.timezone}. Mots schedules the next run itself, so do not call schedule to repeat this routine.`;
}

/** The instruction text of a scheduled delivery input, or `undefined` for ordinary input. */
export function parseScheduledInstruction(content: string): string | undefined {
  if (content.startsWith(SCHEDULED_INSTRUCTION_PREFIX)) {
    const text = content.slice(SCHEDULED_INSTRUCTION_PREFIX.length);
    const note = text.lastIndexOf(RECURRENCE_NOTE_PREFIX);
    return note === -1 ? text : text.slice(0, note);
  }
  const match = /^Autonomous routine \[[^\]]+\] due now: ([\s\S]*)$/.exec(content);
  if (match) {
    const text = match[1];
    const note = text.lastIndexOf(RECURRENCE_NOTE_PREFIX);
    return note === -1 ? text : text.slice(0, note);
  }
  return undefined;
}

/** Extract the routine title if this is an autonomous routine delivery. */
/** Display text of queued user input content: a string or text/image parts. */
function userInputText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (!isRecord(part)) return "";
      if (part.type === "text" && typeof part.text === "string") return part.text;
      if (part.type === "image") return "[Image]";
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

/** A user input waiting in a conversation's inbox for the current turn to finish. */
export interface QueuedInput {
  readonly submissionId: number;
  readonly mode: "steer" | "followUp";
  readonly text: string;
}

/** Queued user inputs of a conversation's `pi.inbox` document; passive writes are not user messages. */
export function queuedInputs(inbox: Readonly<InboxState> | undefined): QueuedInput[] {
  const items: QueuedInput[] = [];
  for (const item of inbox?.items ?? []) {
    if (item.mode === "write") continue;
    items.push({ submissionId: item.id, mode: item.mode, text: userInputText(item.content) });
  }
  return items;
}

export type ConnectionStatus = "connecting" | "connected" | "failed";

export interface ConversationSummary {
  readonly id: number;
  readonly parent?: {
    readonly conversationId: number;
    readonly at: number;
  };
  /** Set for conversations created by a tool call, such as a search subagent. */
  readonly owner?: {
    readonly conversationId: number;
  };
}

export type ClientCommand =
  | {
      readonly type: "presence.typing";
      readonly conversationId: number;
      readonly typing: boolean;
    }
  | {
      readonly type: "conversation.open";
      readonly requestId: string;
      readonly conversationId: number;
    }
  | {
      readonly type: "conversation.create";
      readonly requestId: string;
    }
  | {
      readonly type: "conversation.fork";
      readonly requestId: string;
      readonly conversationId: number;
      readonly entryId: number;
    }
  | {
      readonly type: "prompt.submit";
      readonly requestId: string;
      readonly conversationId: number;
      readonly content: string;
    }
  | {
      readonly type: "conversation.setModel";
      readonly requestId: string;
      readonly conversationId: number;
      readonly provider: string;
      readonly modelId: string;
    }
  | {
      readonly type: "pushToken.register";
      readonly requestId: string;
      readonly token: string;
    }
  | {
      readonly type: "pushToken.clear";
      readonly requestId: string;
    }
  | {
      readonly type: "session.setTimezone";
      readonly requestId: string;
      /** IANA timezone of the device, e.g. `Europe/Rome`. */
      readonly timezone: string;
    }
  | {
      readonly type: "session.setLocale";
      readonly requestId: string;
      /** Language chosen in the app. The agent replies in it and push texts use it. */
      readonly locale: SessionLocale;
    };
export type ClientCommandType = Exclude<ClientCommand["type"], "presence.typing">;

export type CommandResult =
  | {
      readonly type: "command.result";
      readonly command: ClientCommandType;
      readonly requestId: string;
      readonly ok: true;
      readonly conversationId?: number;
      readonly submissionId?: number;
    }
  | {
      readonly type: "command.result";
      readonly command: ClientCommandType;
      readonly requestId: string;
      readonly ok: false;
      readonly error: {
        readonly code: string;
        readonly message: string;
      };
    };

export type ServerEvent =
  | {
      readonly type: "session.snapshot";
      readonly session: {
        readonly conversations: readonly ConversationSummary[];
        readonly activity?: TaskGraph;
      };
    }
  | {
      readonly type: "conversation.created";
      readonly conversation: ConversationSummary;
    }
  | {
      readonly type: "session.activity";
      readonly activity: TaskGraph;
    }
  | {
      readonly type: "conversation.events";
      readonly conversationId: number;
      readonly events: readonly AgentEvent[];
    }
  | {
      readonly type: "conversation.inbox";
      readonly conversationId: number;
      readonly items: readonly QueuedInput[];
    }
  | {
      readonly type: "presence.typing";
      readonly conversationId: number;
      readonly usernames: readonly string[];
    }
  | CommandResult
  | {
      readonly type: "error";
      readonly error: {
        readonly code: string;
        readonly message: string;
      };
    };

export class InvalidClientCommand extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireRequestId = (value: unknown): string => {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_REQUEST_ID_CHARACTERS) {
    throw new InvalidClientCommand(
      `requestId must be a non-empty string of at most ${MAX_REQUEST_ID_CHARACTERS} characters`,
    );
  }
  return value;
};

const requireId = (value: unknown, name: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new InvalidClientCommand(`${name} must be a positive integer`);
  }
  return value;
};

const optionalId = (value: unknown, name: string): number | undefined =>
  value === undefined ? undefined : requireId(value, name);

const EXPO_PUSH_TOKEN_PATTERN = /^(?:ExponentPushToken|ExpoPushToken)\[[^\s\[\]]+\]$/;
const LEGACY_EXPO_PUSH_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const requirePushToken = (value: unknown): string => {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_PUSH_TOKEN_CHARACTERS) {
    throw new InvalidClientCommand(
      `token must be a non-empty string of at most ${MAX_PUSH_TOKEN_CHARACTERS} characters`,
    );
  }
  if (!EXPO_PUSH_TOKEN_PATTERN.test(value) && !LEGACY_EXPO_PUSH_TOKEN_PATTERN.test(value)) {
    throw new InvalidClientCommand("token must be an Expo push token");
  }
  return value;
};

const TIMEZONE_PATTERN = /^[A-Za-z][A-Za-z0-9_+\-]*(?:\/[A-Za-z0-9_+\-]+)*$/;

/** True when `value` names an IANA timezone this runtime's `Intl` accepts. */
export const isTimezone = (value: string): boolean => {
  if (value.length === 0 || value.length > MAX_TIMEZONE_CHARACTERS) return false;
  if (!TIMEZONE_PATTERN.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

const requireTimezone = (value: unknown): string => {
  if (typeof value !== "string" || !isTimezone(value)) {
    throw new InvalidClientCommand("timezone must be an IANA timezone such as Europe/Rome");
  }
  return value;
};

const requireLocale = (value: unknown): SessionLocale => {
  if (typeof value !== "string" || !(SESSION_LOCALES as readonly string[]).includes(value)) {
    throw new InvalidClientCommand(`locale must be one of ${SESSION_LOCALES.join(", ")}`);
  }
  return value as SessionLocale;
};

const commandTypes = new Set<ClientCommandType>([
  "conversation.open",
  "conversation.create",
  "conversation.fork",
  "prompt.submit",
  "conversation.setModel",
  "pushToken.register",
  "pushToken.clear",
  "session.setTimezone",
  "session.setLocale",
]);

const requireCommandType = (value: unknown): ClientCommandType => {
  if (typeof value !== "string" || !commandTypes.has(value as ClientCommandType)) {
    throw new Error("Command result command is invalid");
  }
  return value as ClientCommandType;
};

const requireError = (value: unknown): { readonly code: string; readonly message: string } => {
  if (!isRecord(value) || typeof value.code !== "string" || typeof value.message !== "string") {
    throw new Error("Server error payload is invalid");
  }
  return { code: value.code, message: value.message };
};

const TASK_OUTCOMES = new Set(["completed", "failed", "aborted", "orphaned", "faulted"]);

const taskGraphState = (value: unknown): TaskGraphState => {
  if (!isRecord(value) || typeof value.status !== "string") {
    throw new Error("Activity task state is invalid");
  }
  if (value.status === "pending" || value.status === "running") {
    if (typeof value.phase !== "string") throw new Error("Activity task phase is invalid");
    return { status: value.status, phase: value.phase };
  }
  if (value.status === "waiting") {
    if (
      typeof value.phase !== "string" ||
      !Array.isArray(value.on) ||
      (value.policy !== "failFast" && value.policy !== "allSettled")
    ) {
      throw new Error("Activity waiting task state is invalid");
    }
    return {
      status: value.status,
      phase: value.phase,
      on: value.on.map((id) => requireId(id, "activity.task.state.on")) as unknown as Extract<
        TaskGraphState,
        { status: "waiting" }
      >["on"],
      policy: value.policy,
    };
  }
  if (value.status === "completing") {
    if (typeof value.outcome !== "string" || !TASK_OUTCOMES.has(value.outcome)) {
      throw new Error("Activity completing task outcome is invalid");
    }
    return {
      status: value.status,
      outcome: value.outcome as Extract<TaskGraphState, { status: "completing" }>["outcome"],
    };
  }
  throw new Error("Activity task status is invalid");
};

const parseTaskGraph = (value: unknown): TaskGraph => {
  if (!isRecord(value) || !isRecord(value.tasks)) throw new Error("Activity graph is invalid");
  const tasks: Record<string, TaskGraphNode> = {};
  for (const [key, candidate] of Object.entries(value.tasks)) {
    if (
      !isRecord(candidate) ||
      typeof candidate.kind !== "string" ||
      typeof candidate.background !== "boolean" ||
      typeof candidate.abortRequested !== "boolean" ||
      !Array.isArray(candidate.conversations)
    ) {
      throw new Error("Activity task is invalid");
    }
    const id = requireId(candidate.id, "activity.task.id");
    if (key !== String(id)) throw new Error("Activity task key does not match its id");
    const owner = optionalId(candidate.owner, "activity.task.owner");
    tasks[key] = {
      id: id as TaskGraphNode["id"],
      kind: candidate.kind,
      conversationId: requireId(
        candidate.conversationId,
        "activity.task.conversationId",
      ) as TaskGraphNode["conversationId"],
      ...(owner === undefined ? {} : { owner: owner as NonNullable<TaskGraphNode["owner"]> }),
      background: candidate.background,
      abortRequested: candidate.abortRequested,
      state: taskGraphState(candidate.state),
      conversations: candidate.conversations.map((conversationId) =>
        requireId(conversationId, "activity.task.conversations"),
      ) as unknown as TaskGraphNode["conversations"],
    };
  }
  return { tasks };
};

const parseConversationSummary = (value: unknown): ConversationSummary => {
  if (!isRecord(value)) throw new Error("Conversation summary is invalid");
  const summary: { -readonly [K in keyof ConversationSummary]: ConversationSummary[K] } = {
    id: requireId(value.id, "conversation.id"),
  };
  if (value.parent !== undefined) {
    if (!isRecord(value.parent)) throw new Error("Conversation parent is invalid");
    summary.parent = {
      conversationId: requireId(value.parent.conversationId, "conversation.parent.conversationId"),
      at: requireId(value.parent.at, "conversation.parent.at"),
    };
  }
  if (value.owner !== undefined) {
    if (!isRecord(value.owner)) throw new Error("Conversation owner is invalid");
    summary.owner = {
      conversationId: requireId(value.owner.conversationId, "conversation.owner.conversationId"),
    };
  }
  return summary;
};

export function parseClientCommand(message: string): ClientCommand {
  let value: unknown;
  try {
    value = JSON.parse(message);
  } catch (error) {
    throw new InvalidClientCommand("Message must contain valid JSON", { cause: error });
  }
  if (!isRecord(value) || typeof value.type !== "string") {
    throw new InvalidClientCommand("Message must be a command object");
  }

  if (value.type === "presence.typing") {
    if (typeof value.typing !== "boolean") {
      throw new InvalidClientCommand("typing must be a boolean");
    }
    return {
      type: value.type,
      conversationId: requireId(value.conversationId, "conversationId"),
      typing: value.typing,
    };
  }

  const requestId = requireRequestId(value.requestId);
  switch (value.type) {
    case "conversation.open":
      return {
        type: value.type,
        requestId,
        conversationId: requireId(value.conversationId, "conversationId"),
      };
    case "conversation.create":
      return { type: value.type, requestId };
    case "conversation.fork":
      return {
        type: value.type,
        requestId,
        conversationId: requireId(value.conversationId, "conversationId"),
        entryId: requireId(value.entryId, "entryId"),
      };
    case "prompt.submit": {
      if (typeof value.content !== "string" || value.content.trim().length === 0) {
        throw new InvalidClientCommand("content must contain text");
      }
      if (value.content.length > MAX_PROMPT_CHARACTERS) {
        throw new InvalidClientCommand(`content cannot exceed ${MAX_PROMPT_CHARACTERS} characters`);
      }
      return {
        type: value.type,
        requestId,
        conversationId: requireId(value.conversationId, "conversationId"),
        content: value.content,
      };
    }
    case "conversation.setModel": {
      if (typeof value.provider !== "string" || value.provider.trim().length === 0) {
        throw new InvalidClientCommand("provider must be a non-empty string");
      }
      if (typeof value.modelId !== "string" || value.modelId.trim().length === 0) {
        throw new InvalidClientCommand("modelId must be a non-empty string");
      }
      return {
        type: value.type,
        requestId,
        conversationId: requireId(value.conversationId, "conversationId"),
        provider: value.provider.trim(),
        modelId: value.modelId.trim(),
      };
    }
    case "pushToken.register":
      return { type: value.type, requestId, token: requirePushToken(value.token) };
    case "pushToken.clear":
      return { type: value.type, requestId };
    case "session.setTimezone":
      return { type: value.type, requestId, timezone: requireTimezone(value.timezone) };
    case "session.setLocale":
      return { type: value.type, requestId, locale: requireLocale(value.locale) };
    default:
      throw new InvalidClientCommand(`Unknown command type: ${value.type}`);
  }
}

/** Validate the application envelope. Agent event payloads remain owned by pi-durable's typed protocol. */
export function parseServerEventEnvelope(message: string): ServerEvent {
  const value: unknown = JSON.parse(message);
  if (!isRecord(value) || typeof value.type !== "string") {
    throw new Error("Server message is not an event object");
  }

  switch (value.type) {
    case "session.snapshot": {
      if (!isRecord(value.session) || !Array.isArray(value.session.conversations)) {
        throw new Error("Session snapshot payload is invalid");
      }
      const conversations = value.session.conversations.map(parseConversationSummary);
      return {
        type: value.type,
        session: {
          conversations,
          ...(value.session.activity === undefined
            ? {}
            : { activity: parseTaskGraph(value.session.activity) }),
        },
      };
    }
    case "conversation.created":
      return { type: value.type, conversation: parseConversationSummary(value.conversation) };
    case "session.activity":
      return { type: value.type, activity: parseTaskGraph(value.activity) };
    case "conversation.events": {
      const conversationId = requireId(value.conversationId, "conversationId");
      if (
        !Array.isArray(value.events) ||
        !value.events.every((event) => isRecord(event) && typeof event.type === "string")
      ) {
        throw new Error("Conversation events payload is invalid");
      }
      return {
        type: value.type,
        conversationId,
        events: value.events as unknown as readonly AgentEvent[],
      };
    }
    case "conversation.inbox": {
      const conversationId = requireId(value.conversationId, "conversationId");
      if (!Array.isArray(value.items)) throw new Error("Conversation inbox payload is invalid");
      const items = value.items.map((item): QueuedInput => {
        if (
          !isRecord(item) ||
          (item.mode !== "steer" && item.mode !== "followUp") ||
          typeof item.text !== "string"
        ) {
          throw new Error("Queued input is invalid");
        }
        return {
          submissionId: requireId(item.submissionId, "submissionId"),
          mode: item.mode,
          text: item.text,
        };
      });
      return { type: value.type, conversationId, items };
    }
    case "presence.typing": {
      const conversationId = requireId(value.conversationId, "conversationId");
      if (
        !Array.isArray(value.usernames) ||
        !value.usernames.every((username) => typeof username === "string")
      ) {
        throw new Error("Typing presence payload is invalid");
      }
      return { type: value.type, conversationId, usernames: value.usernames };
    }
    case "command.result": {
      const requestId = requireRequestId(value.requestId);
      const command = requireCommandType(value.command);
      if (value.ok === true) {
        const conversationId = optionalId(value.conversationId, "conversationId");
        const submissionId = optionalId(value.submissionId, "submissionId");
        return {
          type: value.type,
          command,
          requestId,
          ok: true,
          ...(conversationId === undefined ? {} : { conversationId }),
          ...(submissionId === undefined ? {} : { submissionId }),
        };
      }
      if (value.ok === false) {
        return {
          type: value.type,
          command,
          requestId,
          ok: false,
          error: requireError(value.error),
        };
      }
      throw new Error("Command result payload is invalid");
    }
    case "error":
      return { type: value.type, error: requireError(value.error) };
    default:
      throw new Error(`Unknown server event: ${value.type}`);
  }
}
