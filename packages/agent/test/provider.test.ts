import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { Module } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  API_KEY_ENV,
  CATALOG_TIMEOUT_MS,
  DEFAULT_MODELS,
  KILO_GATEWAY_MODELS_URL,
  MOTS_PROVIDERS,
  VERCEL_GATEWAY_BASE_URL,
  VERCEL_GATEWAY_MODELS_URL,
  createMotsModels,
  isFreeGatewayModel,
  isMotsProviderId,
  kiloGatewayProvider,
  providerAuthContext,
  resolveMotsProvider,
  toPiModel,
  type CatalogFetch,
  type GatewayModel,
  type MotsProviderId,
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

const LOCAL_KILO_TOKEN = "mots-local-kilo-token";

const resolveKiloAuth = (env: Record<string, string | undefined>) => {
  const resolve = kiloGatewayProvider([]).auth.apiKey?.resolve;
  if (resolve === undefined) throw new Error("Kilo API key auth is missing");
  return resolve({
    ctx: providerAuthContext(env),
    signal: new AbortController().signal,
  });
};

/**
 * `readStoredKiloToken` loads `node:fs` with `require` at call time. A spy on the ESM namespace
 * misses that call, so this watches `Module.prototype.require` for the duration of one resolve.
 */
const withFsRequireProbe = async <T>(
  work: () => Promise<T>,
): Promise<{ readonly result: T; readonly fsLoads: readonly string[] }> => {
  const original = Module.prototype.require;
  const fsLoads: string[] = [];
  Module.prototype.require = function (this: NodeModule, id: string) {
    if (id === "fs" || id === "node:fs") fsLoads.push(id);
    return original.call(this, id);
  } as typeof Module.prototype.require;
  try {
    return { result: await work(), fsLoads };
  } finally {
    Module.prototype.require = original;
  }
};

describe("kilo provider auth", () => {
  test("reads ~/.pi/agent/auth.json only when MOTS_ALLOW_LOCAL_KILO_AUTH=1", async () => {
    const home = mkdtempSync(join(tmpdir(), "mots-kilo-auth-"));
    const previousHome = process.env.HOME;
    const previousProfile = process.env.USERPROFILE;
    const logged: string[] = [];
    const originalInfo = console.info;
    console.info = (...parts: unknown[]) => {
      logged.push(parts.map((part) => String(part)).join(" "));
    };
    process.env.HOME = home;
    delete process.env.USERPROFILE;
    try {
      mkdirSync(join(home, ".pi", "agent"), { recursive: true });
      writeFileSync(
        join(home, ".pi", "agent", "auth.json"),
        JSON.stringify({ kilo: { access: LOCAL_KILO_TOKEN } }),
      );

      const blocked = await withFsRequireProbe(() => resolveKiloAuth({}));
      const blockedAgain = await withFsRequireProbe(() => resolveKiloAuth({}));
      expect(blocked.fsLoads).toEqual([]);
      expect(blockedAgain.fsLoads).toEqual([]);
      expect(blocked.result).toEqual({ auth: { apiKey: "free" }, source: "kilo-free" });
      expect(blockedAgain.result).toEqual({ auth: { apiKey: "free" }, source: "kilo-free" });
      expect(logged).toEqual(["Kilo auth source: kilo-free"]);

      for (const flag of ["0", "true", "yes", ""]) {
        const ignored = await withFsRequireProbe(() =>
          resolveKiloAuth({ MOTS_ALLOW_LOCAL_KILO_AUTH: flag }),
        );
        expect(ignored.fsLoads).toEqual([]);
        expect(ignored.result).toEqual({ auth: { apiKey: "free" }, source: "kilo-free" });
      }
      expect(logged).toEqual(["Kilo auth source: kilo-free"]);

      const allowed = await withFsRequireProbe(() =>
        resolveKiloAuth({ MOTS_ALLOW_LOCAL_KILO_AUTH: "1" }),
      );
      expect(allowed.fsLoads).toEqual(["node:fs"]);
      expect(allowed.result).toEqual({
        auth: { apiKey: LOCAL_KILO_TOKEN },
        source: "~/.pi/agent/auth.json",
      });
      expect(logged).toEqual(["Kilo auth source: kilo-free"]);

      const fromEnv = await withFsRequireProbe(() =>
        resolveKiloAuth({
          KILO_API_KEY: "sk-from-env",
          MOTS_ALLOW_LOCAL_KILO_AUTH: "1",
        }),
      );
      expect(fromEnv.fsLoads).toEqual([]);
      expect(fromEnv.result).toEqual({ auth: { apiKey: "sk-from-env" }, source: "KILO_API_KEY" });
    } finally {
      console.info = originalInfo;
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      if (previousProfile === undefined) delete process.env.USERPROFILE;
      else process.env.USERPROFILE = previousProfile;
      rmSync(home, { recursive: true, force: true });
    }
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

describe("resolveMotsProvider", () => {
  test("defaults a blank value to kilo and keeps a known id", () => {
    expect(resolveMotsProvider(undefined)).toBe("kilo");
    expect(resolveMotsProvider("  ")).toBe("kilo");
    expect(resolveMotsProvider("nvidia")).toBe("nvidia");
  });

  test("rejects an unknown provider instead of falling back", () => {
    expect(() => resolveMotsProvider("anthropic")).toThrow("MOTS_PROVIDER");
    expect(() => resolveMotsProvider("Kilo")).toThrow("MOTS_PROVIDER");
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

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const withDeadline = async <T>(work: Promise<T>, message: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), 1_000);
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    clearTimeout(timer);
  }
};

const hangUntilAbort: CatalogFetch = (_url, init) =>
  new Promise((_resolve, reject) => {
    const signal = init.signal;
    const fail = () =>
      reject(signal.reason instanceof Error ? signal.reason : new Error("aborted"));
    if (signal.aborted) fail();
    else signal.addEventListener("abort", fail, { once: true });
  });

const kiloCatalog = {
  data: [
    {
      id: "custom/from-catalog",
      name: "From catalog",
      context_length: 32_000,
      supported_parameters: ["tools"],
      pricing: { prompt: "0", completion: "0" },
      architecture: { input_modalities: ["text"] },
    },
  ],
};

const vercelCatalog = {
  data: [
    {
      id: "custom/vercel",
      name: "From gateway",
      supported_parameters: ["tools"],
      context_window: 8_000,
      max_tokens: 1_000,
      pricing: { input: "0", output: "0" },
    },
  ],
};

describe("createMotsModels", () => {
  test("bounds a catalog fetch to a few seconds", () => {
    expect(CATALOG_TIMEOUT_MS).toBeGreaterThanOrEqual(2_000);
    expect(CATALOG_TIMEOUT_MS).toBeLessThanOrEqual(5_000);
  });

  test("does not fetch a catalog for an OpenRouter session", async () => {
    const urls: string[] = [];
    const fetchImpl: CatalogFetch = async (url) => {
      urls.push(url);
      throw new Error("unexpected catalog fetch");
    };
    const models = await withDeadline(
      createMotsModels({}, "openrouter", { fetch: fetchImpl }),
      "OpenRouter startup waited on a catalog",
    );
    expect(urls).toEqual([]);
    expect(models.getModels("openrouter").length).toBeGreaterThan(0);
    expect(models.getModels("nvidia").length).toBeGreaterThan(0);
    expect(models.getModels("kilo")).toEqual([]);
    expect(models.getModels("vercel-ai-gateway")).toEqual([]);
  });

  test("does not fetch a catalog for an NVIDIA session", async () => {
    const urls: string[] = [];
    const fetchImpl: CatalogFetch = async (url) => {
      urls.push(url);
      throw new Error("unexpected catalog fetch");
    };
    const models = await withDeadline(
      createMotsModels({}, "nvidia", { fetch: fetchImpl }),
      "NVIDIA startup waited on a catalog",
    );
    expect(urls).toEqual([]);
    expect(models.getModels("nvidia").length).toBeGreaterThan(0);
    expect(models.getModels("kilo")).toEqual([]);
    expect(models.getModels("vercel-ai-gateway")).toEqual([]);
  });

  test("fetches only the Kilo catalog when Kilo is selected", async () => {
    const urls: string[] = [];
    const fetchImpl: CatalogFetch = async (url, init) => {
      urls.push(url);
      expect(init.signal).toBeDefined();
      if (url !== KILO_GATEWAY_MODELS_URL) return hangUntilAbort(url, init);
      return jsonResponse(kiloCatalog);
    };
    const models = await withDeadline(
      createMotsModels({}, "kilo", { fetch: fetchImpl, timeoutMs: 50 }),
      "Kilo startup waited on another catalog",
    );
    expect(urls).toEqual([KILO_GATEWAY_MODELS_URL]);
    expect(models.getModel("kilo", "custom/from-catalog")).toBeDefined();
    expect(models.getModel("kilo", "kilo-auto/free")).toBeUndefined();
    expect(models.getModels("vercel-ai-gateway")).toEqual([]);
  });

  test("fetches only the Vercel catalog when Vercel is selected", async () => {
    const urls: string[] = [];
    const fetchImpl: CatalogFetch = async (url, init) => {
      urls.push(url);
      if (url !== VERCEL_GATEWAY_MODELS_URL) return hangUntilAbort(url, init);
      return jsonResponse(vercelCatalog);
    };
    const models = await withDeadline(
      createMotsModels({}, "vercel-ai-gateway", { fetch: fetchImpl, timeoutMs: 50 }),
      "Vercel startup waited on another catalog",
    );
    expect(urls).toEqual([VERCEL_GATEWAY_MODELS_URL]);
    expect(models.getModel("vercel-ai-gateway", "custom/vercel")).toBeDefined();
    expect(models.getModels("kilo")).toEqual([]);
  });

  test("falls back to the hardcoded Kilo models when the catalog times out", async () => {
    const urls: string[] = [];
    const fetchImpl: CatalogFetch = async (url, init) => {
      urls.push(url);
      return hangUntilAbort(url, init);
    };
    const models = await withDeadline(
      createMotsModels({}, "kilo", { fetch: fetchImpl, timeoutMs: 50 }),
      "Kilo catalog fetch blocked startup",
    );
    expect(urls).toEqual([KILO_GATEWAY_MODELS_URL]);
    expect(models.getModel("kilo", "reflection/beam-free")).toBeDefined();
    expect(models.getModel("kilo", "kilo-auto/free")).toBeDefined();
    expect(models.getModels("vercel-ai-gateway")).toEqual([]);
  });

  test("falls back to the hardcoded Kilo models when the catalog request fails", async () => {
    const urls: string[] = [];
    const fetchImpl: CatalogFetch = async (url) => {
      urls.push(url);
      return jsonResponse({ error: "down" }, 503);
    };
    const models = await createMotsModels({}, "kilo", { fetch: fetchImpl, timeoutMs: 50 });
    expect(urls).toEqual([KILO_GATEWAY_MODELS_URL]);
    expect(models.getModel("kilo", "reflection/beam-free")).toBeDefined();
    expect(models.getModel("kilo", "kilo-auto/free")).toBeDefined();
  });

  test("does not wait on a hung Vercel catalog past the timeout", async () => {
    const urls: string[] = [];
    const fetchImpl: CatalogFetch = async (url, init) => {
      urls.push(url);
      return hangUntilAbort(url, init);
    };
    const models = await withDeadline(
      createMotsModels({}, "vercel-ai-gateway", { fetch: fetchImpl, timeoutMs: 50 }),
      "Vercel catalog fetch blocked startup",
    );
    expect(urls).toEqual([VERCEL_GATEWAY_MODELS_URL]);
    expect(models.getModels("vercel-ai-gateway")).toEqual([]);
    expect(models.getModels("kilo")).toEqual([]);
    expect(models.getModels("openrouter").length).toBeGreaterThan(0);
  });

  test("attaches an abort signal when the caller does not override the timeout", async () => {
    const signals: AbortSignal[] = [];
    const fetchImpl: CatalogFetch = async (_url, init) => {
      signals.push(init.signal);
      return jsonResponse({ data: [] });
    };
    const providers: readonly MotsProviderId[] = ["kilo", "vercel-ai-gateway"];
    for (const provider of providers) {
      const before = signals.length;
      await createMotsModels({}, provider, { fetch: fetchImpl });
      const signal = signals[before];
      expect(signal).toBeDefined();
      expect(signal?.aborted).toBe(false);
    }
  });
});
