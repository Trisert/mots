import type { Message } from "@earendil-works/pi-ai";

/** The plain text of one model message. Tool results and non-text parts contribute nothing. */
export function messageText(message: Message | undefined): string {
  if (message === undefined || message.role === "toolResult") return "";
  if (typeof message.content === "string") return message.content;
  return message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");
}
