import { describe, expect, test } from "bun:test";
import type { ConversationSnapshot, LiveConversation } from "@mots/client";
import { conversationStatus } from "../src/conversation-status.ts";

const snapshot = (live: LiveConversation | null): ConversationSnapshot => ({
  id: 1,
  entries: [],
  live,
  tools: [],
  compactions: [],
  queued: [],
  typing: [],
});

describe("conversationStatus", () => {
  test("a chat without a snapshot has not run anything, so it is idle", () => {
    expect(conversationStatus(undefined)).toBe("idle");
  });

  test("a chat with nothing live is idle", () => {
    expect(conversationStatus(snapshot(null))).toBe("idle");
    expect(conversationStatus(snapshot({ active: false, text: "" }))).toBe("idle");
  });

  test("a chat with an active turn is working", () => {
    expect(conversationStatus(snapshot({ active: true, text: "" }))).toBe("working");
  });

  test("a pending retry wins over the active turn it belongs to", () => {
    const retrying = { active: true, text: "", retry: { at: 1, error: "timeout" } };
    expect(conversationStatus(snapshot(retrying))).toBe("retrying");
  });
});
