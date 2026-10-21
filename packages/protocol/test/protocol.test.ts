import { describe, expect, test } from "bun:test";
import {
  formatScheduledInstruction,
  InvalidClientCommand,
  parseClientCommand,
  parseScheduledInstruction,
  parseServerEventEnvelope,
  queuedInputs,
} from "../src/index.ts";

describe("scheduled instructions", () => {
  test("round-trips a one-off instruction", () => {
    const text = formatScheduledInstruction({
      id: "schedule:1",
      instruction: "Bevi un bicchiere d'acqua",
    });
    expect(text).toContain("Bevi un bicchiere d'acqua");
    expect(parseScheduledInstruction(text)).toBe("Bevi un bicchiere d'acqua");
  });

  test("round-trips a recurring instruction and hides recurrence notes", () => {
    const text = formatScheduledInstruction({
      id: "schedule:2",
      instruction: "Fai una passeggiata",
      recurrence: {
        cadence: { unit: "day", interval: 2 },
        timezone: "Europe/Rome",
      },
    });
    expect(text).toContain("It repeats every 2 days in Europe/Rome");
    expect(parseScheduledInstruction(text)).toBe("Fai una passeggiata");
  });

  test("returns undefined for ordinary input", () => {
    expect(parseScheduledInstruction("Ciao Mots")).toBeUndefined();
  });
});

describe("queued inputs", () => {
  test("filters writes and flattens content parts", () => {
    type Inbox = Parameters<typeof queuedInputs>[0];
    const inbox = {
      items: [
        { id: 1, mode: "steer", content: "ciao" },
        { id: 2, mode: "write", entry: { kind: "app.note", data: {} } },
        {
          id: 3,
          mode: "followUp",
          content: [
            { type: "text", text: "guarda" },
            { type: "image" },
          ],
        },
      ],
    } as unknown as Inbox;

    expect(queuedInputs(inbox)).toEqual([
      { submissionId: 1, mode: "steer", text: "ciao" },
      { submissionId: 3, mode: "followUp", text: "guarda\n[Image]" },
    ]);
  });

  test("returns an empty list without an inbox", () => {
    expect(queuedInputs(undefined)).toEqual([]);
  });
});

describe("client commands", () => {
  test("accepts a valid prompt", () => {
    expect(
      parseClientCommand(
        JSON.stringify({
          type: "prompt.submit",
          requestId: "req-1",
          conversationId: 1,
          content: "Ciao",
        }),
      ),
    ).toEqual({
      type: "prompt.submit",
      requestId: "req-1",
      conversationId: 1,
      content: "Ciao",
    });
  });

  test("rejects empty prompts and invalid ids", () => {
    expect(() =>
      parseClientCommand(
        JSON.stringify({
          type: "prompt.submit",
          requestId: "req-1",
          conversationId: 1,
          content: "   ",
        }),
      ),
    ).toThrow(InvalidClientCommand);

    expect(() =>
      parseClientCommand(
        JSON.stringify({
          type: "conversation.open",
          requestId: "req-1",
          conversationId: 0,
        }),
      ),
    ).toThrow(InvalidClientCommand);
  });

  test("rejects malformed JSON", () => {
    expect(() => parseClientCommand("{")).toThrow(InvalidClientCommand);
  });
});

describe("server events", () => {
  test("parses a session snapshot with parents", () => {
    const event = parseServerEventEnvelope(
      JSON.stringify({
        type: "session.snapshot",
        session: {
          conversations: [
            { id: 1 },
            { id: 2, parent: { conversationId: 1, at: 7 } },
          ],
        },
      }),
    );

    expect(event).toEqual({
      type: "session.snapshot",
      session: {
        conversations: [
          { id: 1 },
          { id: 2, parent: { conversationId: 1, at: 7 } },
        ],
      },
    });
  });

  test("parses typing presence", () => {
    expect(
      parseServerEventEnvelope(
        JSON.stringify({
          type: "presence.typing",
          conversationId: 1,
          usernames: ["Luca", "Anna"],
        }),
      ),
    ).toEqual({
      type: "presence.typing",
      conversationId: 1,
      usernames: ["Luca", "Anna"],
    });
  });

  test("rejects invalid typing payloads", () => {
    expect(() =>
      parseServerEventEnvelope(
        JSON.stringify({
          type: "presence.typing",
          conversationId: 1,
          usernames: [42],
        }),
      ),
    ).toThrow();
  });

  test("rejects unknown events", () => {
    expect(() =>
      parseServerEventEnvelope(JSON.stringify({ type: "unknown" })),
    ).toThrow("Unknown server event");
  });
});
