import { describe, expect, test } from "bun:test";
import {
  presentCalmError,
  presentConnection,
  presentError,
  presentModel,
  providerLabel,
  shortModelName,
} from "../src/present.ts";

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
    expect(presentError("The session is not connected")).toBe("La sessione non è connessa.");
    expect(presentError("The session connection failed.")).toBe(
      "La connessione con la sessione non è riuscita.",
    );
  });

  test("translates the prompt length error", () => {
    expect(presentError("A prompt cannot exceed 100,000 characters")).toBe(
      "Un messaggio non può superare 100,000 caratteri.",
    );
  });

  test("passes server text through", () => {
    expect(presentError("Try again later")).toBe("Try again later");
  });

  test("translates a model the server refused", () => {
    expect(presentError("That model is not available.")).toBe(
      "Quel modello non è disponibile su questo server.",
    );
  });
});

describe("presentCalmError", () => {
  test("keeps a short line and hides the technical text", () => {
    const calm = presentCalmError(
      '401: {"code":"INVALID_TOKEN","message":"Your authentication token is invalid."}',
    );
    expect(calm.line).toBe("Qualcosa non ha funzionato.");
    expect(calm.detail).toContain("INVALID_TOKEN");
  });

  test("uses one sentence for a refused model", () => {
    expect(presentCalmError("That model is not available.")).toEqual({
      line: "Quel modello non è disponibile.",
      detail: "Quel modello non è disponibile su questo server.",
    });
  });
});

describe("presentConnection", () => {
  test("keeps a dead socket distinct from a connection in progress", () => {
    const failed = presentConnection("failed");
    const connecting = presentConnection("connecting");
    expect(failed.busy).toBe(false);
    expect(failed.canRetry).toBe(true);
    expect(failed.title).not.toBe(connecting.title);
    expect(failed.label).not.toContain("Connessione");
    expect(connecting.busy).toBe(true);
    expect(connecting.label).toBe("Connessione…");
  });

  test("shows a translated error on a terminal failure", () => {
    expect(presentConnection("failed", "The session connection failed.").body).toBe(
      "La connessione con la sessione non è riuscita.",
    );
  });

  test("does not offer retry while the session is up", () => {
    const connected = presentConnection("connected", "The session is not connected");
    expect(connected.tone).toBe("ok");
    expect(connected.canRetry).toBe(false);
    expect(connected.busy).toBe(false);
  });
});
