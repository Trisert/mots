import { describe, expect, test } from "bun:test";
import { createMotsHarnessOptions } from "../src/chat.ts";
import { createStubModels, STUB_MODEL_TEXT } from "../src/stub-models.ts";

describe("stub model port", () => {
  test("answers locally and does not fetch when the harness is given the stub", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("The stub model port tried to use the network.");
    }) as unknown as typeof fetch;
    try {
      const options = await createMotsHarnessOptions(async () => undefined, {
        models: createStubModels(),
      });
      const model = options.models.getModel("kilo", "reflection/beam-free");
      expect(model).toBeDefined();
      if (model === undefined) return;
      const message = await options.models.completeSimple(model, { messages: [] });
      expect(message.stopReason).toBe("stop");
      expect(message.content).toEqual([{ type: "text", text: STUB_MODEL_TEXT }]);
      const stream = options.models.streamSimple(model, { messages: [] });
      const streamed = await stream.result();
      expect(streamed.content).toEqual([{ type: "text", text: STUB_MODEL_TEXT }]);
    } finally {
      globalThis.fetch = original;
    }
  });
});
