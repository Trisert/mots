import { describe, expect, test } from "bun:test";
import {
  parseModelCatalog,
  formatScheduledInstruction,
  InvalidClientCommand,
  isTimezone,
  MAX_PUSH_TOKEN_CHARACTERS,
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
    expect(text).toContain("do not call schedule to repeat this routine");
    expect(text).not.toContain("sourceScheduleId");
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

  test("accepts a valid setModel command", () => {
    expect(
      parseClientCommand(
        JSON.stringify({
          type: "conversation.setModel",
          requestId: "req-model-1",
          conversationId: 1,
          provider: "openrouter",
          modelId: "anthropic/claude-3.5-sonnet",
        }),
      ),
    ).toEqual({
      type: "conversation.setModel",
      requestId: "req-model-1",
      conversationId: 1,
      provider: "openrouter",
      modelId: "anthropic/claude-3.5-sonnet",
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

describe("push token commands", () => {
  const exponentToken = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";
  const expoToken = "ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]";
  const legacyToken = "F5741A13-BCDA-434B-A316-5DC0E6FFA94F";

  const bracketToken = (extra: number): string => {
    const prefix = "ExpoPushToken[";
    const suffix = "]";
    return `${prefix}${"a".repeat(extra)}${suffix}`;
  };

  test("registers an Expo push token and clears it", () => {
    expect(
      parseClientCommand(
        JSON.stringify({
          type: "pushToken.register",
          requestId: "req-push-1",
          token: exponentToken,
        }),
      ),
    ).toEqual({
      type: "pushToken.register",
      requestId: "req-push-1",
      token: exponentToken,
    });

    expect(
      parseClientCommand(
        JSON.stringify({
          type: "pushToken.register",
          requestId: "req-push-2",
          token: expoToken,
        }),
      ),
    ).toEqual({
      type: "pushToken.register",
      requestId: "req-push-2",
      token: expoToken,
    });

    expect(
      parseClientCommand(
        JSON.stringify({
          type: "pushToken.register",
          requestId: "req-push-3",
          token: legacyToken,
        }),
      ),
    ).toEqual({
      type: "pushToken.register",
      requestId: "req-push-3",
      token: legacyToken,
    });

    expect(
      parseClientCommand(
        JSON.stringify({ type: "pushToken.clear", requestId: "req-push-4" }),
      ),
    ).toEqual({ type: "pushToken.clear", requestId: "req-push-4" });
  });

  test("accepts a token at the size limit and rejects a longer one", () => {
    const atLimit = bracketToken(
      MAX_PUSH_TOKEN_CHARACTERS - "ExpoPushToken[".length - "]".length,
    );
    expect(atLimit.length).toBe(MAX_PUSH_TOKEN_CHARACTERS);
    expect(
      parseClientCommand(
        JSON.stringify({ type: "pushToken.register", requestId: "req-push-5", token: atLimit }),
      ),
    ).toEqual({ type: "pushToken.register", requestId: "req-push-5", token: atLimit });

    const overLimit = `${atLimit.slice(0, -1)}a]`;
    expect(overLimit.length).toBe(MAX_PUSH_TOKEN_CHARACTERS + 1);
    expect(() =>
      parseClientCommand(
        JSON.stringify({ type: "pushToken.register", requestId: "req-push-6", token: overLimit }),
      ),
    ).toThrow(
      `token must be a non-empty string of at most ${MAX_PUSH_TOKEN_CHARACTERS} characters`,
    );
  });

  test("rejects tokens Expo would not accept", () => {
    const rejected = [
      "",
      "not-a-token",
      "ExpoPushToken[]",
      "ExpoPushToken[abc def]",
      "ExpoPushToken[abc]extra]",
      "exponentpushtoken[xxxxxxxxxxxxxxxxxxxxxx]",
      "dOKpuo4qbsM:APA91bHkSmF84ROx7Y-2eMGxc0lmpQeN33ZwDMG763dkjd8yjKK-rhPtiR1OoIWNG5ZshlL8oyxsTnQ5XtahyBNS9mJAvfeE6aHzv_mOF_Ve4vL2po4clMIYYV2-Iea_sZVJF7xFLXih4Y0y88JNYULxFfz-XXXXX",
      "5fa729c6e535eb568g18fdabd35785fc60f41c161d9d7cf4b0bbb0d92437fda0",
    ];
    for (const token of rejected) {
      expect(() =>
        parseClientCommand(
          JSON.stringify({ type: "pushToken.register", requestId: "req-push-7", token }),
        ),
      ).toThrow(InvalidClientCommand);
    }

    expect(() =>
      parseClientCommand(
        JSON.stringify({ type: "pushToken.register", requestId: "req-push-8", token: 12 }),
      ),
    ).toThrow(InvalidClientCommand);
    expect(() =>
      parseClientCommand(JSON.stringify({ type: "pushToken.register", requestId: "req-push-9" })),
    ).toThrow(InvalidClientCommand);
    expect(() =>
      parseClientCommand(JSON.stringify({ type: "pushToken.clear" })),
    ).toThrow(InvalidClientCommand);
    expect(() =>
      parseClientCommand(JSON.stringify({ type: "pushToken.unknown", requestId: "req-push-10" })),
    ).toThrow(InvalidClientCommand);
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

  test("parses push token command results", () => {
    expect(
      parseServerEventEnvelope(
        JSON.stringify({
          type: "command.result",
          command: "pushToken.register",
          requestId: "req-push-1",
          ok: true,
        }),
      ),
    ).toEqual({
      type: "command.result",
      command: "pushToken.register",
      requestId: "req-push-1",
      ok: true,
    });

    expect(
      parseServerEventEnvelope(
        JSON.stringify({
          type: "command.result",
          command: "pushToken.clear",
          requestId: "req-push-2",
          ok: false,
          error: { code: "command_failed", message: "Push token was not stored" },
        }),
      ),
    ).toEqual({
      type: "command.result",
      command: "pushToken.clear",
      requestId: "req-push-2",
      ok: false,
      error: { code: "command_failed", message: "Push token was not stored" },
    });
  });
});

describe("session timezone", () => {
  test("accepts an IANA timezone", () => {
    expect(
      parseClientCommand(
        JSON.stringify({ type: "session.setTimezone", requestId: "req-tz-1", timezone: "Europe/Rome" }),
      ),
    ).toEqual({ type: "session.setTimezone", requestId: "req-tz-1", timezone: "Europe/Rome" });
    expect(isTimezone("UTC")).toBe(true);
    expect(isTimezone("America/Argentina/Buenos_Aires")).toBe(true);
    expect(isTimezone("Etc/GMT+1")).toBe(true);
  });

  test("rejects values that are not timezones", () => {
    for (const timezone of ["", "Mars/Olympus", "Europe/Rome\n", "../etc", "+01:00", 42, "A".repeat(101)]) {
      expect(() =>
        parseClientCommand(
          JSON.stringify({ type: "session.setTimezone", requestId: "req-tz-2", timezone }),
        ),
      ).toThrow(InvalidClientCommand);
    }
  });
});

describe("parseModelCatalog", () => {
  const valid = {
    providers: [{ id: "kilo", name: "Kilo" }],
    models: [
      {
        provider: "kilo",
        id: "reflection/beam-free",
        name: "Reflection Beam",
        free: true,
        vision: false,
        reasoning: true,
        contextWindow: 128_000,
        recommended: true,
      },
    ],
    default: { provider: "kilo", modelId: "reflection/beam-free" },
  };

  test("accepts a well-formed catalog", () => {
    expect(parseModelCatalog(valid)).toEqual(valid);
  });

  test("rejects malformed entries", () => {
    expect(() => parseModelCatalog({ ...valid, models: [{ ...valid.models[0], free: "yes" }] })).toThrow();
    expect(() => parseModelCatalog({ ...valid, models: [{ ...valid.models[0], contextWindow: -1 }] })).toThrow();
    expect(() => parseModelCatalog({ ...valid, default: undefined })).toThrow();
    expect(() => parseModelCatalog({ ...valid, providers: [{ id: "", name: "x" }] })).toThrow();
    expect(() => parseModelCatalog(null)).toThrow();
  });
});
