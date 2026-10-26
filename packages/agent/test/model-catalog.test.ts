import { describe, expect, test } from "bun:test";
import {
  isOfferedModel,
  modelCatalog,
  modelPolicy,
  type CatalogSource,
} from "../src/model-catalog.ts";

const priced = (id: string, cost: number, extra: object = {}) => ({
  id,
  name: id,
  cost: { input: cost, output: cost },
  ...extra,
});

const source: CatalogSource = {
  getModels: (provider) =>
    ({
      kilo: [priced("reflection/beam-free", 0), priced("kilo/paid", 1)],
      openrouter: [
        priced("z/zeta", 1),
        priced("anthropic/claude-haiku-5.5", 1, { input: ["text", "image"], reasoning: true }),
        priced("openai/gpt-6-luna", 1, { contextWindow: 400_000 }),
        priced("openai/gpt-6-luna:batch", 1),
        priced("~openai/gpt-latest", 1),
        priced("open/free-one", 0),
      ],
      nvidia: [priced("nvidia/nemotron-3.5-lightning-30b-a3b", 0)],
      "vercel-ai-gateway": [],
    })[provider] ?? [],
};

describe("modelPolicy", () => {
  test("offers the selected provider, Kilo, and providers whose key is set", () => {
    expect(modelPolicy({}, "kilo").providers).toEqual(["kilo"]);
    expect(modelPolicy({ OPENROUTER_API_KEY: "k" }, "kilo").providers).toEqual(["kilo", "openrouter"]);
    expect(modelPolicy({ NVIDIA_API_KEY: " " }, "openrouter").providers).toEqual(["kilo", "openrouter"]);
  });

  test("limits Kilo to free models without a Kilo key", () => {
    expect(modelPolicy({}, "kilo").freeOnly).toEqual(["kilo"]);
    expect(modelPolicy({ KILO_API_KEY: "k" }, "kilo").freeOnly).toEqual([]);
  });

  test("uses MOTS_MODEL as the default when set", () => {
    expect(modelPolicy({ MOTS_MODEL: "kilo-auto/free" }, "kilo").defaultModelId).toBe("kilo-auto/free");
    expect(modelPolicy({}, "openrouter").defaultModelId).toBe("openai/gpt-6-luna");
  });
});

describe("isOfferedModel", () => {
  const policy = modelPolicy({}, "openrouter");

  test("accepts listed models and refuses the rest", () => {
    expect(isOfferedModel(source, policy, "openrouter", "z/zeta")).toBe(true);
    expect(isOfferedModel(source, policy, "kilo", "reflection/beam-free")).toBe(true);
    expect(isOfferedModel(source, policy, "kilo", "kilo/paid")).toBe(false);
    expect(isOfferedModel(source, policy, "nvidia", "nvidia/nemotron-3.5-lightning-30b-a3b")).toBe(false);
    expect(isOfferedModel(source, policy, "openrouter", "openai/gpt-6-luna:batch")).toBe(false);
    expect(isOfferedModel(source, policy, "openrouter", "~openai/gpt-latest")).toBe(false);
    expect(isOfferedModel(source, policy, "openrouter", "made/up")).toBe(false);
    expect(isOfferedModel(source, policy, "anthropic", "x")).toBe(false);
  });
});

describe("modelCatalog", () => {
  const catalog = modelCatalog(source, modelPolicy({ NVIDIA_API_KEY: "k" }, "openrouter"));

  test("lists configured providers with names and the default model", () => {
    expect(catalog.providers).toEqual([
      { id: "kilo", name: "Kilo" },
      { id: "openrouter", name: "OpenRouter" },
      { id: "nvidia", name: "NVIDIA" },
    ]);
    expect(catalog.default).toEqual({ provider: "openrouter", modelId: "openai/gpt-6-luna" });
  });

  test("puts the default and recommended models first, then the rest by name", () => {
    const ids = catalog.models.filter((model) => model.provider === "openrouter").map((model) => model.id);
    expect(ids).toEqual(["openai/gpt-6-luna", "anthropic/claude-haiku-5.5", "open/free-one", "z/zeta"]);
  });

  test("describes each model and hides what cannot be picked", () => {
    const haiku = catalog.models.find((model) => model.id === "anthropic/claude-haiku-5.5");
    expect(haiku).toEqual({
      provider: "openrouter",
      id: "anthropic/claude-haiku-5.5",
      name: "anthropic/claude-haiku-5.5",
      free: false,
      vision: true,
      reasoning: true,
      contextWindow: 0,
      recommended: true,
    });
    expect(catalog.models.find((model) => model.id === "kilo/paid")).toBeUndefined();
    expect(catalog.models.find((model) => model.id === "open/free-one")?.free).toBe(true);
    // NVIDIA's zero price is trial credit, not a free model.
    expect(catalog.models.find((model) => model.provider === "nvidia")?.free).toBe(false);
  });
});
