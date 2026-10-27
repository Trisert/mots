// Pure decisions for screen reader status announcements in the chat.
// No React or React Native imports: the screen owns the refs and the I/O.

export const REPLY_ANNOUNCEMENT = "Mots ha risposto";
export const THINKING_ANNOUNCEMENT = "Mots sta scrivendo";

export type TranscriptLike = {
  readonly id: number;
  readonly role: string;
};

/** What the screen remembers about the transcript it rendered last. */
export type TranscriptMark = {
  readonly conversationId: number | undefined;
  readonly lastAssistantId: number | undefined;
  readonly hadEntries: boolean;
};

export function lastAssistantId(entries: readonly TranscriptLike[]): number | undefined {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry !== undefined && entry.role === "assistant") return entry.id;
  }
  return undefined;
}

export function markTranscript(
  conversationId: number | undefined,
  entries: readonly TranscriptLike[],
): TranscriptMark {
  return {
    conversationId,
    lastAssistantId: lastAssistantId(entries),
    hadEntries: entries.length > 0,
  };
}

/**
 * Returns the text to announce when a reply has just finished, or undefined.
 *
 * A reply is announced only when the previous render showed a non-empty
 * transcript for the same conversation, and the last assistant entry is a
 * newer id than before. That keeps the first load, a snapshot that arrives
 * after an empty placeholder, and a conversation switch silent.
 */
export function replyAnnouncement(
  previous: TranscriptMark | undefined,
  next: TranscriptMark,
): string | undefined {
  if (previous === undefined) return undefined;
  if (previous.conversationId !== next.conversationId) return undefined;
  if (!previous.hadEntries) return undefined;
  if (next.lastAssistantId === undefined) return undefined;
  if (next.lastAssistantId === previous.lastAssistantId) return undefined;
  if (previous.lastAssistantId !== undefined && next.lastAssistantId < previous.lastAssistantId) {
    return undefined;
  }
  return REPLY_ANNOUNCEMENT;
}

/** Returns the text to announce when a run starts (live turns from inactive to active). */
export function thinkingAnnouncement(
  previouslyActive: boolean | undefined,
  nowActive: boolean,
): string | undefined {
  return previouslyActive === false && nowActive ? THINKING_ANNOUNCEMENT : undefined;
}

export const LOST_CONNECTION_ANNOUNCEMENT = "Connessione interrotta";
export const RECONNECTED_ANNOUNCEMENT = "Di nuovo in linea";

/**
 * Returns the text to announce when the connection status changes, or undefined.
 *
 * The first status is silent, so a normal start does not talk over the screen. Only a drop and a
 * recovery after a drop are announced; the connecting steps in between stay quiet.
 */
export function connectionAnnouncement(previous: string | undefined, next: string): string | undefined {
  if (previous === undefined || previous === next) return undefined;
  if (next === "failed") return LOST_CONNECTION_ANNOUNCEMENT;
  if (previous === "failed" && next === "connected") return RECONNECTED_ANNOUNCEMENT;
  return undefined;
}
