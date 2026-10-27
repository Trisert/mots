import { describe, expect, test } from "bun:test";
import {
  presentConnection,
  presentError,
  presentModel,
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
  test("translates client connection errors", () => {
    expect(presentError("The session is not connected", t)).toBe("The session is not connected.");
    expect(presentError("The session connection failed.", t)).toBe(
      "The connection to the session failed.",
    );
  });

  test("translates the prompt length error", () => {
    expect(presentError("A prompt cannot exceed 100,000 characters", t)).toBe(
      "A message cannot exceed 100,000 characters.",
    );
  });

  test("passes server text through", () => {
    expect(presentError("Try again later", t)).toBe("Try again later");
  });

  test("translates a model the server refused", () => {
    expect(presentError("That model is not available.", t)).toBe(
      "That model is not available on this server.",
    );
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
    expect(presentConnection("failed", t, "The session connection failed.").body).toBe(
      "The connection to the session failed.",
    );
  });

  test("does not offer retry while the session is up", () => {
    const connected = presentConnection("connected", t, "The session is not connected");
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
