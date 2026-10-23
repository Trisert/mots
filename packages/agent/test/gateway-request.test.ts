import { describe, expect, test } from "bun:test";
import type { AuthContext } from "@earendil-works/pi-ai";
import { createModels } from "@earendil-works/pi-ai/models";
import { toPiModel, vercelGatewayProvider } from "../src/provider.ts";

/**
 * The gateway is picky about the request shape: its catalog lists `max_tokens` for every model and
 * `max_completion_tokens` for none, and it fans requests out to many upstream providers. These
 * tests capture the body Pi actually sends, with fetch mocked, so a change in the compat flags
 * that would break the gateway fails here rather than in production.
 */
const model = {
  id: "reflection/beam-free",
  name: "Beam 1.0 (Free)",
  context_window: 1_048_576,
  max_tokens: 131_072,
  pricing: { input: "0", output: "0" },
  modalities: { input: ["text"] },
  supported_parameters: ["max_tokens", "temperature", "stop", "tools", "tool_choice", "reasoning"],
  reasoning_options: [{ type: "effort", values: ["low", "medium", "high", "xhigh", "max"] }],
};

const captureRequest = async (thinkingLevel: "off" | "low") => {
  const models = createModels({
    authContext: {
      async env(name: string) {
        return name === "AI_GATEWAY_API_KEY" ? "vck_test_key" : undefined;
      },
      async fileExists() {
        return false;
      },
    } satisfies AuthContext,
  });

  const provider = vercelGatewayProvider([]);
  const piModel = toPiModel(model)!;
  models.setProvider({
    ...provider,
    getModels: () => [piModel],
  });

  const registered = models.getModel("vercel-ai-gateway", "reflection/beam-free");
  if (registered === undefined) throw new Error("model not registered");

  let captured: { url: string; body: Record<string, unknown> } | undefined;
  const mockFetch = async (input: unknown, init: { body?: string }) => {
    captured = {
      url: String((input as { url?: string })?.url ?? input),
      body: init.body === undefined ? {} : JSON.parse(init.body),
    };
    return new Response(JSON.stringify({ error: { message: "captured", type: "test" } }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  };

  // The harness passes `reasoning` only when the thinking level is not "off".
  const options: Record<string, unknown> = { fetch: mockFetch as unknown as typeof fetch };
  if (thinkingLevel !== "off") options.reasoning = thinkingLevel;

  const stream = models.streamSimple(
    registered,
    {
      systemPrompt: "You are Mots.",
      messages: [{ role: "user", content: "Remember that my cat is called Pixel.", timestamp: 0 }],
      tools: [
        {
          name: "remember",
          description: "Save a fact",
          parameters: {
            type: "object",
            properties: { fact: { type: "string" } },
            required: ["fact"],
          },
        },
      ],
    },
    options as never,
  );
  for await (const _ of stream) {
    // Drain until the mocked call fails.
  }
  await stream.result().catch(() => {});

  if (captured === undefined) throw new Error("no request was captured");
  return captured;
};

describe("gateway request shape", () => {
  test("posts to the gateway chat completions endpoint", async () => {
    const request = await captureRequest("off");
    expect(request.url).toBe("https://ai-gateway.vercel.sh/v1/chat/completions");
  });

  test("sends max_tokens, the field the catalog lists", async () => {
    const request = await captureRequest("off");
    expect(request.body.max_tokens).toBe(131_072);
    expect(request.body.max_completion_tokens).toBeUndefined();
  });

  test("does not send the store flag", async () => {
    const request = await captureRequest("off");
    expect(request.body.store).toBeUndefined();
  });

  test("sends the system prompt as a system message", async () => {
    const request = await captureRequest("off");
    const messages = request.body.messages as { role: string }[];
    expect(messages[0]?.role).toBe("system");
  });

  test("omits the reasoning effort when thinking is off", async () => {
    const request = await captureRequest("off");
    expect(request.body.reasoning_effort).toBeUndefined();
  });

  test("sends the reasoning effort when thinking is on", async () => {
    const request = await captureRequest("low");
    expect(request.body.reasoning_effort).toBe("low");
  });

  test("sends the tools to the model", async () => {
    const request = await captureRequest("off");
    expect(request.body.tools).toHaveLength(1);
  });
});
