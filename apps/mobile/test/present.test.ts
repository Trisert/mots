import { describe, expect, test } from "bun:test";
import { CLIENT_ERROR } from "@mots/client";
import { COMMAND_ERROR, MAX_PROMPT_CHARACTERS } from "@mots/protocol";
import {
  presentConnection,
  presentError,
  presentModel,
  presentRawError,
  presentRunError,
  providerLabel,
  shortModelName,
} from "../src/present.ts";
import { englishTranslate as t } from "../src/i18n/translate.ts";

describe("presentModel", () => {
  test("reads the model the server reported", () => {
    expect(
      presentModel({ model: { provider: "kilo", modelId: "reflection/beam-free" } }),
    ).toEqual({
      provider: "kilo",
      modelId: "reflection/beam-free",
      shortName: "beam-free",
    });
  });

  test("does not invent a model when the agent has not arrived", () => {
    expect(presentModel(undefined)).toBeUndefined();
    expect(presentModel({})).toBeUndefined();
    expect(presentModel({ model: { provider: " ", modelId: "x" } })).toBeUndefined();
  });
});

describe("shortModelName", () => {
  test("uses the segment after the last slash", () => {
    expect(shortModelName("openai/gpt-4o-mini")).toBe("gpt-4o-mini");
  });

  test("keeps an id that has no slash", () => {
    expect(shortModelName("beam-free")).toBe("beam-free");
  });
});

describe("providerLabel", () => {
  test("names the known providers", () => {
    expect(providerLabel("vercel-ai-gateway")).toBe("Vercel");
    expect(providerLabel("custom")).toBe("custom");
  });
});

describe("presentError", () => {
  test("translates client errors by code", () => {
    expect(presentError({ code: CLIENT_ERROR.notConnected, message: "" }, t)).toBe(
      "The session is not connected.",
    );
    expect(presentError({ code: CLIENT_ERROR.connectionFailed, message: "" }, t)).toBe(
      "The connection to the session failed.",
    );
    expect(presentError({ code: CLIENT_ERROR.emptyPrompt, message: "" }, t)).toBe(
      "Write a message before sending.",
    );
    expect(presentError({ code: CLIENT_ERROR.invalidFrame, message: "" }, t)).toBe(
      "The server sent an invalid message.",
    );
  });

  test("uses the protocol prompt limit for the prompt-too-long copy", () => {
    expect(
      presentError(
        {
          code: CLIENT_ERROR.promptTooLong,
          message: `A prompt cannot exceed ${MAX_PROMPT_CHARACTERS.toLocaleString()} characters`,
        },
        t,
      ),
    ).toBe(`A message cannot exceed ${MAX_PROMPT_CHARACTERS.toLocaleString()} characters.`);
  });

  test("translates server errors by code", () => {
    expect(presentError({ code: COMMAND_ERROR.modelNotAllowed, message: "" }, t)).toBe(
      "That model is not available on this server.",
    );
    expect(presentError({ code: COMMAND_ERROR.dailyLimitReached, message: "" }, t)).toBe(
      "This session reached today's message limit. It resets at 00:00 UTC.",
    );
    expect(presentError({ code: COMMAND_ERROR.commandFailed, message: "" }, t)).toBe(
      "Something went wrong.",
    );
  });

  test("falls back to an unknown error's message", () => {
    expect(presentError({ code: "future_error", message: "Try again later" }, t)).toBe(
      "Try again later",
    );
  });

  test("uses generic copy when an unknown error has no message", () => {
    expect(presentError({ code: "future_error", message: " \n " }, t)).toBe(
      "Something went wrong.",
    );
  });
});

describe("presentRawError", () => {
  test("trims raw messages and uses generic copy when empty", () => {
    expect(presentRawError("  Try again later  ", t)).toBe("Try again later");
    expect(presentRawError(" \n ", t)).toBe("Something went wrong.");
  });
});

describe("presentConnection", () => {
  test("keeps a dead socket distinct from a connection in progress", () => {
    const failed = presentConnection("failed", t);
    const connecting = presentConnection("connecting", t);
    expect(failed.busy).toBe(false);
    expect(failed.canRetry).toBe(true);
    expect(failed.title).not.toBe(connecting.title);
    expect(failed.label).not.toBe(connecting.label);
    expect(connecting.busy).toBe(true);
    expect(connecting.label).toBe("Connecting…");
  });

  test("shows a translated error on a terminal failure", () => {
    expect(
      presentConnection("failed", t, {
        code: CLIENT_ERROR.connectionFailed,
        message: "The session connection failed.",
      }).body,
    ).toBe(
      "The connection to the session failed.",
    );
  });

  test("does not offer retry while the session is up", () => {
    const connected = presentConnection("connected", t, {
      code: CLIENT_ERROR.notConnected,
      message: "The session is not connected",
    });
    expect(connected.tone).toBe("ok");
    expect(connected.canRetry).toBe(false);
    expect(connected.busy).toBe(false);
  });
});

describe("presentRunError", () => {
  test("maps a silent run failure to its copy", () => {
    expect(presentRunError("no_response", t)).toBe(
      "The model did not respond. Check the provider's limits or credits, then try again.",
    );
  });
});
