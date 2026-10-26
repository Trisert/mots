import { describe, expect, test } from "bun:test";
import type { ModelCatalogEntry, ModelCatalogResponse } from "@mots/protocol";
import { contextLabel, modelBadges, modelSections } from "../src/model-picker.ts";

const entry = (overrides: Partial<ModelCatalogEntry>): ModelCatalogEntry => ({
  provider: "openrouter",
  id: "x/model",
  name: "Model",
  free: false,
  vision: false,
  reasoning: false,
  contextWindow: 0,
  recommended: false,
  ...overrides,
});

const catalog: ModelCatalogResponse = {
  providers: [
    { id: "kilo", name: "Kilo" },
    { id: "openrouter", name: "OpenRouter" },
  ],
  models: [
    entry({ provider: "kilo", id: "reflection/beam-free", name: "Reflection Beam", free: true, recommended: true }),
    entry({ id: "anthropic/claude-haiku-5.5", name: "Claude Haiku 5.5", recommended: true }),
    entry({ id: "open/free-one", name: "Free One", free: true }),
    entry({ id: "z/zeta", name: "Zéta" }),
  ],
  default: { provider: "kilo", modelId: "reflection/beam-free" },
};

const ids = (sections: ReturnType<typeof modelSections>) =>
  sections.map((section) => [section.title, section.data.map((model) => model.id)]);

describe("modelSections", () => {
  test("groups recommended, free, then the rest", () => {
    expect(ids(modelSections(catalog, { query: "" }))).toEqual([
      ["Consigliati", ["reflection/beam-free", "anthropic/claude-haiku-5.5"]],
      ["Gratis", ["open/free-one"]],
      ["Tutti i modelli", ["z/zeta"]],
    ]);
  });

  test("filters by provider and drops empty sections", () => {
    expect(ids(modelSections(catalog, { query: "", provider: "kilo" }))).toEqual([
      ["Consigliati", ["reflection/beam-free"]],
    ]);
  });

  test("searches name, id and provider, every word, ignoring case and accents", () => {
    expect(ids(modelSections(catalog, { query: "zeta" }))).toEqual([["Tutti i modelli", ["z/zeta"]]]);
    expect(ids(modelSections(catalog, { query: "HAIKU anthropic" }))).toEqual([
      ["Consigliati", ["anthropic/claude-haiku-5.5"]],
    ]);
    expect(ids(modelSections(catalog, { query: "kilo" }))).toEqual([
      ["Consigliati", ["reflection/beam-free"]],
    ]);
    expect(modelSections(catalog, { query: "nothing matches" })).toEqual([]);
  });
});

describe("badges", () => {
  test("formats the context window", () => {
    expect(contextLabel(0)).toBeUndefined();
    expect(contextLabel(128_000)).toBe("128K");
    expect(contextLabel(1_000_000)).toBe("1M");
    expect(contextLabel(1_048_576)).toBe("1M");
    expect(contextLabel(2_500_000)).toBe("2.5M");
  });

  test("lists what a model can do", () => {
    expect(modelBadges(entry({ free: true, vision: true, reasoning: true, contextWindow: 200_000 }))).toEqual([
      "Gratis",
      "Immagini",
      "Ragionamento",
      "200K",
    ]);
    expect(modelBadges(entry({}))).toEqual([]);
  });
});
