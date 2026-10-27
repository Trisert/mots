import { describe, expect, test } from "bun:test";
import {
  connectionAnnouncement,
  lastAssistantId,
  markTranscript,
  replyAnnouncement,
  thinkingAnnouncement,
} from "../src/announce.ts";
import { englishTranslate as t } from "../src/i18n/translate.ts";

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
    expect(replyAnnouncement(before, after, t)).toBe("Mots replied");
  });

  test("announces a newer reply in a transcript that already had one", () => {
    const before = markTranscript(1, [user(1), assistant(2)]);
    const after = markTranscript(1, [user(1), assistant(2), user(3), assistant(4)]);
    expect(replyAnnouncement(before, after, t)).toBe("Mots replied");
  });

  test("stays silent on the first render", () => {
    expect(replyAnnouncement(undefined, markTranscript(1, [user(1), assistant(2)]), t)).toBeUndefined();
  });

  test("stays silent when an existing transcript arrives after an empty one", () => {
    const before = markTranscript(1, []);
    const after = markTranscript(1, [user(1), assistant(2), user(3), assistant(4)]);
    expect(replyAnnouncement(before, after, t)).toBeUndefined();
  });

  test("stays silent when the conversation changes", () => {
    const before = markTranscript(1, [user(1), assistant(2)]);
    const after = markTranscript(2, [user(7), assistant(8)]);
    expect(replyAnnouncement(before, after, t)).toBeUndefined();
  });

  test("stays silent when the last assistant entry did not change", () => {
    const before = markTranscript(1, [user(1), assistant(2)]);
    const after = markTranscript(1, [user(1), assistant(2), user(3)]);
    expect(replyAnnouncement(before, after, t)).toBeUndefined();
  });

  test("stays silent when the transcript has no assistant entry", () => {
    const before = markTranscript(1, [user(1)]);
    const after = markTranscript(1, [user(1), user(2)]);
    expect(replyAnnouncement(before, after, t)).toBeUndefined();
  });

  test("stays silent when the last assistant id goes backwards", () => {
    const before = markTranscript(1, [user(1), assistant(5)]);
    const after = markTranscript(1, [user(1), assistant(3)]);
    expect(replyAnnouncement(before, after, t)).toBeUndefined();
  });
});

describe("thinkingAnnouncement", () => {
  test("announces when a run starts", () => {
    expect(thinkingAnnouncement(false, true, t)).toBe("Mots is typing");
  });

  test("stays silent on the first render, even when already live", () => {
    expect(thinkingAnnouncement(undefined, true, t)).toBeUndefined();
  });

  test("stays silent while the run continues or ends", () => {
    expect(thinkingAnnouncement(true, true, t)).toBeUndefined();
    expect(thinkingAnnouncement(true, false, t)).toBeUndefined();
    expect(thinkingAnnouncement(false, false, t)).toBeUndefined();
  });
});

describe("connectionAnnouncement", () => {
  test("is silent for the first status and for steps that do not change the outcome", () => {
    expect(connectionAnnouncement(undefined, "connecting", t)).toBeUndefined();
    expect(connectionAnnouncement("connecting", "connected", t)).toBeUndefined();
    expect(connectionAnnouncement("failed", "failed", t)).toBeUndefined();
  });

  test("announces a dropped connection", () => {
    expect(connectionAnnouncement("connected", "failed", t)).toBe("Connection lost");
  });

  test("announces a recovery after a drop", () => {
    expect(connectionAnnouncement("failed", "connected", t)).toBe("Back online");
  });
});
