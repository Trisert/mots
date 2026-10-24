import { describe, expect, test } from "bun:test";
import {
  API_KEY_ENV,
  DEFAULT_MODELS,
  MOTS_PROVIDERS,
  VERCEL_GATEWAY_BASE_URL,
  isFreeGatewayModel,
  isMotsProviderId,
  providerAuthContext,
  toPiModel,
  type GatewayModel,
} from "../src/provider.ts";

const gatewayModel = (overrides: Partial<GatewayModel> = {}): GatewayModel => ({
  id: "reflection/beam-free",
  name: "Beam Free",
  supported_parameters: ["tools"],
  ...overrides,
});

describe("isFreeGatewayModel", () => {
  test("treats a model priced at zero on both directions as free", () => {
    expect(isFreeGatewayModel(gatewayModel({ pricing: { input: "0", output: "0" } }))).toBe(
      true,
    );
  });

  test("rejects a model with a non-zero price", () => {
    expect(
      isFreeGatewayModel(gatewayModel({ pricing: { input: "0.000002", output: "0" } })),
    ).toBe(false);
    expect(
      isFreeGatewayModel(gatewayModel({ pricing: { input: "0", output: "0.00001" } })),
    ).toBe(false);
    expect(
      isFreeGatewayModel(gatewayModel({ pricing: { input: "0.000002", output: "0.00001" } })),
    ).toBe(false);
  });

  test("rejects a model without pricing information", () => {
    expect(isFreeGatewayModel(gatewayModel())).toBe(false);
    expect(isFreeGatewayModel(gatewayModel({ pricing: {} }))).toBe(false);
  });

  test("requires both directions to be free", () => {
    expect(
      isFreeGatewayModel(gatewayModel({ pricing: { input: "0", output: "0.000003" } })),
    ).toBe(false);
  });

  test("rejects a model whose price depends on the provider", () => {
    // The zero is only the cheapest upstream: the request may be served by one that charges.
    expect(
      isFreeGatewayModel(
        gatewayModel({ pricing: { input: "0", output: "0", varies_by_provider: true } }),
      ),
    ).toBe(false);
  });
});

describe("toPiModel", () => {
  test("drops models that cannot call tools", () => {
    expect(toPiModel(gatewayModel({ supported_parameters: ["reasoning"] }))).toBeUndefined();
    expect(toPiModel(gatewayModel({ supported_parameters: [] }))).toBeUndefined();
    expect(toPiModel(gatewayModel({ supported_parameters: undefined }))).toBeUndefined();
  });

  test("maps a tool-capable model onto the Pi model shape", () => {
    const model = toPiModel(gatewayModel());
    expect(model).toBeDefined();
    expect(model?.id).toBe("reflection/beam-free");
    expect(model?.name).toBe("Beam Free");
    expect(model?.api).toBe("openai-completions");
    expect(model?.provider).toBe("vercel-ai-gateway");
    expect(model?.baseUrl).toBe(VERCEL_GATEWAY_BASE_URL);
    expect(model?.input).toEqual(["text"]);
  });

  test("falls back to the model id when the gateway sends no name", () => {
    const model = toPiModel(gatewayModel({ name: undefined }));
    expect(model?.name).toBe("reflection/beam-free");
  });

  test("accepts a custom base url", () => {
    const model = toPiModel(gatewayModel(), "https://gateway.example/v1");
    expect(model?.baseUrl).toBe("https://gateway.example/v1");
  });

  test("converts the per-token price into a per-million price", () => {
    const model = toPiModel(
      gatewayModel({ pricing: { input: "0.000002", output: "0.00001" } }),
    );
    expect(model?.cost.input).toBe(2);
    expect(model?.cost.output).toBe(10);
    expect(model?.cost.cacheRead).toBe(0);
    expect(model?.cost.cacheWrite).toBe(0);
  });

  test("treats a free model as costing nothing", () => {
    const model = toPiModel(gatewayModel({ pricing: { input: "0", output: "0" } }));
    expect(model?.cost.input).toBe(0);
    expect(model?.cost.output).toBe(0);
  });

  test("carries the cache prices over", () => {
    // The gateway charges for a cache read separately: reporting zero would understate the cost.
    const model = toPiModel(
      gatewayModel({
        pricing: {
          input: "0.000003",
          output: "0.000015",
          input_cache_read: "0.0000003",
          input_cache_write: "0.00000375",
        },
      }),
    );
    expect(model?.cost.cacheRead).toBe(0.3);
    expect(model?.cost.cacheWrite).toBe(3.75);
  });

  test("maps the tiered pricing of a long context", () => {
    const model = toPiModel(
      gatewayModel({
        pricing: {
          input: "0.000003",
          output: "0.000015",
          input_tiers: [
            { cost: "0.000003", min: 0, max: 200_001 },
            { cost: "0.000006", min: 200_001 },
          ],
          output_tiers: [
            { cost: "0.000015", min: 0, max: 200_001 },
            { cost: "0.0000225", min: 200_001 },
          ],
        },
      }),
    );
    expect(model?.cost.tiers).toHaveLength(2);
    expect(model?.cost.tiers?.[0]?.input).toBe(3);
    expect(model?.cost.tiers?.[0]?.output).toBe(15);
    expect(model?.cost.tiers?.[0]?.inputTokensAbove).toBe(0);
    expect(model?.cost.tiers?.[1]?.input).toBe(6);
    expect(model?.cost.tiers?.[1]?.output).toBe(22.5);
    expect(model?.cost.tiers?.[1]?.inputTokensAbove).toBe(200_001);
  });

  test("reports no tiers for a model priced at a flat rate", () => {
    const model = toPiModel(gatewayModel({ pricing: { input: "0", output: "0" } }));
    expect(model?.cost.tiers).toBeUndefined();
  });

  test("carries the context window and the token limit over", () => {
    const model = toPiModel(gatewayModel({ context_window: 200_000, max_tokens: 16_000 }));
    expect(model?.contextWindow).toBe(200_000);
    expect(model?.maxTokens).toBe(16_000);
  });

  test("marks a model as reasoning only when the gateway exposes an effort control", () => {
    const reasoning = toPiModel(
      gatewayModel({
        supported_parameters: ["tools", "reasoning"],
        reasoning_options: [{ type: "effort", values: ["low", "medium", "high"] }],
      }),
    );
    expect(reasoning?.reasoning).toBe(true);
    expect(reasoning?.compat?.supportsReasoningEffort).toBe(true);

    const plain = toPiModel(gatewayModel({ supported_parameters: ["tools"] }));
    expect(plain?.reasoning).toBe(false);
  });

  test("leaves a model without an effort control out of the reasoning path", () => {
    // 33 of the gateway models advertise "reasoning" but expose a toggle or a token budget
    // instead: Pi would send them a `reasoning_effort` they do not understand.
    const toggleOnly = toPiModel(
      gatewayModel({
        supported_parameters: ["tools", "reasoning"],
        reasoning_options: [{ type: "toggle" }],
      }),
    );
    expect(toggleOnly?.reasoning).toBe(false);
    expect(toggleOnly?.compat?.supportsReasoningEffort).toBe(false);
    expect(toggleOnly?.thinkingLevelMap).toBeUndefined();

    const budgetOnly = toPiModel(
      gatewayModel({
        supported_parameters: ["tools", "reasoning"],
        reasoning_options: [{ type: "budget_tokens", min: 1024 }],
      }),
    );
    expect(budgetOnly?.reasoning).toBe(false);
    expect(budgetOnly?.compat?.supportsReasoningEffort).toBe(false);
  });

  test("maps the thinking levels only when the gateway publishes effort options", () => {
    const withEffort = toPiModel(
      gatewayModel({
        supported_parameters: ["tools", "reasoning"],
        reasoning_options: [{ type: "effort", values: ["low", "medium", "high"] }],
      }),
    );
    // Only the levels the model actually offers are mapped; the ones above `high` fall back to the
    // closest supported level, so Pi never sends an effort the model would reject.
    expect(withEffort?.thinkingLevelMap).toEqual({
      minimal: "low",
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: "high",
      max: "high",
    });

    const withoutEffort = toPiModel(
      gatewayModel({
        supported_parameters: ["tools", "reasoning"],
        reasoning_options: [{ type: "budget" }],
      }),
    );
    expect(withoutEffort?.thinkingLevelMap).toBeUndefined();

    const withoutOptions = toPiModel(
      gatewayModel({ supported_parameters: ["tools", "reasoning"] }),
    );
    expect(withoutOptions?.thinkingLevelMap).toBeUndefined();
  });

  test("declares the gateway compatibility flags", () => {
    const model = toPiModel(gatewayModel());
    expect(model?.compat?.maxTokensField).toBe("max_tokens");
    expect(model?.compat?.supportsStore).toBe(false);
    // The system prompt goes out as a `system` message: the gateway routes to many upstream
    // providers and only the `system` role is understood by all of them.
    expect(model?.compat?.supportsDeveloperRole).toBe(false);
  });

  test("accepts image input only when the gateway advertises it", () => {
    const withImage = toPiModel(
      gatewayModel({ modalities: { input: ["text", "image"] } }),
    );
    expect(withImage?.input).toEqual(["text", "image"]);

    const textOnly = toPiModel(gatewayModel({ modalities: { input: ["text"] } }));
    expect(textOnly?.input).toEqual(["text"]);
  });
});

describe("providerAuthContext", () => {
  test("returns the value of a variable that is set", async () => {
    const context = providerAuthContext({ OPENROUTER_API_KEY: "sk-test-123" });
    expect(await context.env("OPENROUTER_API_KEY")).toBe("sk-test-123");
  });

  test("returns undefined for a variable that is missing or blank", async () => {
    const context = providerAuthContext({
      OPENROUTER_API_KEY: "",
      AI_GATEWAY_API_KEY: "   ",
    });
    expect(await context.env("OPENROUTER_API_KEY")).toBeUndefined();
    expect(await context.env("AI_GATEWAY_API_KEY")).toBeUndefined();
    expect(await context.env("NVIDIA_API_KEY")).toBeUndefined();
  });

  test("never reports a credential file", async () => {
    const context = providerAuthContext({});
    expect(await context.fileExists("~/.config/mots/credentials.json")).toBe(false);
  });
});

describe("isMotsProviderId", () => {
  test("accepts every supported provider", () => {
    expect(isMotsProviderId("openrouter")).toBe(true);
    expect(isMotsProviderId("vercel-ai-gateway")).toBe(true);
    expect(isMotsProviderId("nvidia")).toBe(true);
  });

  test("rejects an unknown provider", () => {
    expect(isMotsProviderId("anthropic")).toBe(false);
    expect(isMotsProviderId("")).toBe(false);
    expect(isMotsProviderId("OpenRouter")).toBe(false);
  });
});

describe("provider configuration", () => {
  test("lists the supported providers", () => {
    expect([...MOTS_PROVIDERS]).toEqual([
      "kilo",
      "openrouter",
      "vercel-ai-gateway",
      "nvidia",
    ]);
  });

  test("gives every provider a default model and an API key variable", () => {
    for (const provider of MOTS_PROVIDERS) {
      expect(DEFAULT_MODELS[provider]).toBeTruthy();
      expect(API_KEY_ENV[provider]).toBeTruthy();
    }
  });
});
