import { describe, expect, test } from "bun:test";
import {
  connectionAnnouncement,
  lastAssistantId,
  markTranscript,
  replyAnnouncement,
  thinkingAnnouncement,
  REPLY_ANNOUNCEMENT,
  THINKING_ANNOUNCEMENT,
} from "../src/announce.ts";

const user = (id: number) => ({ id, role: "user" });
const assistant = (id: number) => ({ id, role: "assistant" });

describe("lastAssistantId", () => {
  test("returns the id of the last assistant entry", () => {
    expect(lastAssistantId([user(1), assistant(2), user(3)])).toBe(2);
  });

  test("is undefined without assistant entries", () => {
    expect(lastAssistantId([])).toBeUndefined();
    expect(lastAssistantId([user(1)])).toBeUndefined();
  });
});

describe("replyAnnouncement", () => {
  test("announces when a new assistant reply follows the user message", () => {
    const before = markTranscript(1, [user(1)]);
    const after = markTranscript(1, [user(1), assistant(2)]);
    expect(replyAnnouncement(before, after)).toBe(REPLY_ANNOUNCEMENT);
    expect(REPLY_ANNOUNCEMENT).toBe("Mots ha risposto");
  });

  test("announces a newer reply in a transcript that already had one", () => {
    const before = markTranscript(1, [user(1), assistant(2)]);
    const after = markTranscript(1, [user(1), assistant(2), user(3), assistant(4)]);
    expect(replyAnnouncement(before, after)).toBe(REPLY_ANNOUNCEMENT);
  });

  test("stays silent on the first render", () => {
    expect(replyAnnouncement(undefined, markTranscript(1, [user(1), assistant(2)]))).toBeUndefined();
  });

  test("stays silent when an existing transcript arrives after an empty one", () => {
    const before = markTranscript(1, []);
    const after = markTranscript(1, [user(1), assistant(2), user(3), assistant(4)]);
    expect(replyAnnouncement(before, after)).toBeUndefined();
  });

  test("stays silent when the conversation changes", () => {
    const before = markTranscript(1, [user(1), assistant(2)]);
    const after = markTranscript(2, [user(7), assistant(8)]);
    expect(replyAnnouncement(before, after)).toBeUndefined();
  });

  test("stays silent when the last assistant entry did not change", () => {
    const before = markTranscript(1, [user(1), assistant(2)]);
    const after = markTranscript(1, [user(1), assistant(2), user(3)]);
    expect(replyAnnouncement(before, after)).toBeUndefined();
  });

  test("stays silent when the transcript has no assistant entry", () => {
    const before = markTranscript(1, [user(1)]);
    const after = markTranscript(1, [user(1), user(2)]);
    expect(replyAnnouncement(before, after)).toBeUndefined();
  });

  test("stays silent when the last assistant id goes backwards", () => {
    const before = markTranscript(1, [user(1), assistant(5)]);
    const after = markTranscript(1, [user(1), assistant(3)]);
    expect(replyAnnouncement(before, after)).toBeUndefined();
  });
});

describe("thinkingAnnouncement", () => {
  test("announces when a run starts", () => {
    expect(thinkingAnnouncement(false, true)).toBe(THINKING_ANNOUNCEMENT);
    expect(THINKING_ANNOUNCEMENT).toBe("Mots sta scrivendo");
  });

  test("stays silent on the first render, even when already live", () => {
    expect(thinkingAnnouncement(undefined, true)).toBeUndefined();
  });

  test("stays silent while the run continues or ends", () => {
    expect(thinkingAnnouncement(true, true)).toBeUndefined();
    expect(thinkingAnnouncement(true, false)).toBeUndefined();
    expect(thinkingAnnouncement(false, false)).toBeUndefined();
  });
});

describe("connectionAnnouncement", () => {
  test("is silent for the first status and for steps that do not change the outcome", () => {
    expect(connectionAnnouncement(undefined, "connecting")).toBeUndefined();
    expect(connectionAnnouncement("connecting", "connected")).toBeUndefined();
    expect(connectionAnnouncement("failed", "failed")).toBeUndefined();
  });

  test("announces a dropped connection", () => {
    expect(connectionAnnouncement("connected", "failed")).toBe("Connessione interrotta");
  });

  test("announces a recovery after a drop", () => {
    expect(connectionAnnouncement("failed", "connected")).toBe("Di nuovo in linea");
  });
});
