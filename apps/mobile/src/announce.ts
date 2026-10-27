// Pure decisions for screen reader status announcements in the chat.
// No React or React Native imports: the screen owns the refs and the I/O.

import type { Translate } from "./i18n/translate";

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
  t: Translate,
): string | undefined {
  if (previous === undefined) return undefined;
  if (previous.conversationId !== next.conversationId) return undefined;
  if (!previous.hadEntries) return undefined;
  if (next.lastAssistantId === undefined) return undefined;
  if (next.lastAssistantId === previous.lastAssistantId) return undefined;
  if (previous.lastAssistantId !== undefined && next.lastAssistantId < previous.lastAssistantId) {
    return undefined;
  }
  return t("announce.reply");
}

/** Returns the text to announce when a run starts (live turns from inactive to active). */
export function thinkingAnnouncement(
  previouslyActive: boolean | undefined,
  nowActive: boolean,
  t: Translate,
): string | undefined {
  return previouslyActive === false && nowActive ? t("announce.thinking") : undefined;
}
