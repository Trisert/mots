import { defineDoc } from "@earendil-works/pi-durable";
import type { ClientCommand } from "@mots/protocol";

/** One Expo push token for the session. A later register replaces it. */
export const PushTokenDoc = defineDoc<{ token?: string }>({
  kind: "app.push-token",
  version: 1,
  scope: "session",
  initial: () => ({}),
});

type PushTokenCommand = Extract<
  ClientCommand,
  { readonly type: "pushToken.register" | "pushToken.clear" }
>;

/**
 * Store or remove the session's only push token.
 * The caller passes a command `parseClientCommand` already accepted.
 */
export function applyPushTokenCommand(doc: { token?: string }, command: PushTokenCommand): void {
  if (command.type === "pushToken.clear") {
    delete doc.token;
    return;
  }
  doc.token = command.token;
}

export function readStoredPushToken(
  doc: { readonly token?: string } | undefined,
): string | undefined {
  const token = doc?.token;
  return typeof token === "string" && token.length > 0 ? token : undefined;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const PUSH_TIMEOUT_MS = 8_000;
const TITLE_CHARACTERS = 80;
const BODY_CHARACTERS = 500;

let expoAccessToken: string | undefined;

/** Remember the Worker's optional Expo access token. A blank value clears it. */
export function useExpoAccessToken(token: string | undefined): void {
  const trimmed = token?.trim() ?? "";
  expoAccessToken = trimmed.length > 0 ? trimmed : undefined;
}

type ReminderPush = {
  readonly id: string;
  readonly conversationId: number;
  readonly instruction: string;
  readonly name?: string;
};

const clip = (value: string, max: number): string => {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 3)}...`;
};

const reminderMessage = (reminder: ReminderPush, token: string, bodyText?: string) => {
  const title = clip(reminder.name ?? "", TITLE_CHARACTERS);
  const body = clip(bodyText ?? reminder.instruction, BODY_CHARACTERS);
  return {
    to: token,
    title: title.length > 0 ? title : "Mots",
    body: body.length > 0 ? body : "A scheduled reminder is ready.",
    sound: "default" as const,
    priority: "high" as const,
    data: {
      scheduleId: reminder.id,
      conversationId: reminder.conversationId,
    },
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const ticketError = (payload: unknown): string | undefined => {
  const data = isRecord(payload) ? payload.data : undefined;
  const tickets = Array.isArray(data) ? data : [data];
  for (const ticket of tickets) {
    if (!isRecord(ticket) || ticket.status !== "error") continue;
    const details = isRecord(ticket.details) ? ticket.details.error : undefined;
    const code =
      typeof details === "string" && /^[A-Za-z0-9_]{1,64}$/.test(details) ? details : "rejected";
    return `Expo push was rejected (${code})`;
  }
  return undefined;
};

/**
 * POST one reminder to Expo. Throws when the request fails.
 * The delivery caller must catch that and still write the next recurrence row.
 */
export async function sendReminderPush(reminder: ReminderPush, token: string): Promise<void> {
  await postPush(reminderMessage(reminder, token));
}

/** Tell the user a routine stopped after repeated failed runs. Throws when the request fails. */
export async function sendRoutineStoppedPush(reminder: ReminderPush, token: string): Promise<void> {
  await postPush(
    reminderMessage(reminder, token, "Stopped after repeated failed runs. Open Mots to restart it."),
  );
}

async function postPush(message: ReturnType<typeof reminderMessage>): Promise<void> {
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
  };
  if (expoAccessToken !== undefined) headers.Authorization = `Bearer ${expoAccessToken}`;
  const response = await globalThis.fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Expo push failed with status ${response.status}`);
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return;
  }
  const error = ticketError(payload);
  if (error !== undefined) throw new Error(error);
}
