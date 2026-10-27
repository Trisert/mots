import type { ConversationSnapshot } from "@mots/client";
import type { Translate } from "./i18n/translate";

/** What a chat is doing, as shown by the dot beside its name in the menu. */
export type ConversationStatus = "idle" | "working" | "retrying";

/** A chat with no snapshot has not run anything yet, so it reads as idle. */
export function conversationStatus(snapshot: ConversationSnapshot | undefined): ConversationStatus {
  if (snapshot?.live?.retry !== undefined) return "retrying";
  if (snapshot?.live?.active === true) return "working";
  return "idle";
}

/** Accessible name for the status, added to the chat's label in the menu. */
export function statusLabel(status: ConversationStatus, t: Translate): string {
  return t(`status.${status}`);
}
