import { describe, expect, test } from "bun:test";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type {
  AgentEvent,
  ConversationId,
  EntryId,
  EntryRecord,
} from "@earendil-works/pi-durable";
import {
  initialSessionState,
  sessionReducer,
  type SessionState,
} from "../src/session-state.ts";

const usage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

const partial: AssistantMessage = {
  role: "assistant",
  content: [{ type: "text", text: "partial" }],
  api: "openai-completions",
  provider: "test",
  model: "test-model",
  usage,
  stopReason: "pending",
  timestamp: 0,
};

const conversationId = 1 as ConversationId;
const entry: EntryRecord = {
  id: 2 as EntryId,
  conversationId,
  kind: "pi.assistant",
  model: [{ ...partial, content: [{ type: "text", text: "committed" }] }],
};

function applyAgentEvents(state: SessionState, events: readonly AgentEvent[]): SessionState {
  return sessionReducer(state, {
    type: "event",
    event: { type: "conversation.events", conversationId, events },
  });
}

describe("sessionReducer message updates", () => {
  test("drops an inconsistent partial and keeps the committed assistant entry", () => {
    let state = applyAgentEvents(initialSessionState, [
      { type: "run_start", inputs: [] },
      { type: "message_start", message: partial },
    ]);
    const started = state.snapshots[1]!;
    expect(started.partial).toEqual(partial);
    expect(started.runHasAssistant).toBe(true);

    expect(() => {
      state = applyAgentEvents(state, [
        {
          type: "message_update",
          usage,
          changes: [{ type: "text_delta", contentIndex: 1, delta: "broken" }],
        },
      ]);
    }).not.toThrow();

    const dropped = state.snapshots[1]!;
    expect(dropped.partial).toBeUndefined();
    expect(dropped.live).toEqual(started.live);
    expect(dropped.runHasAssistant).toBe(true);

    state = applyAgentEvents(state, [
      {
        type: "message_update",
        usage,
        changes: [{ type: "text_delta", contentIndex: 0, delta: " ignored" }],
      },
    ]);
    expect(state.snapshots[1]).toBe(dropped);

    state = applyAgentEvents(state, [{ type: "message_end", entry }]);
    expect(state.snapshots[1]?.entries).toHaveLength(1);
    expect(state.snapshots[1]?.entries[0]?.text).toBe("committed");

    state = applyAgentEvents(state, [{ type: "run_end", inputs: [] }]);
    expect(state.snapshots[1]?.runError).toBeUndefined();
  });
});
