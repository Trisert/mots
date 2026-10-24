import { describe, expect, test } from "bun:test";
import { COMMAND_ERROR } from "@mots/protocol";
import { isAllowedAgentModel, ModelNotAllowedError, type ModelCatalog } from "../src/allowlist.ts";

const catalog = (known: Readonly<Record<string, readonly string[]>>): ModelCatalog => ({
  getModel(provider, id) {
    return known[provider]?.includes(id) === true ? { id } : undefined;
  },
});

const models = catalog({
  kilo: ["reflection/beam-free"],
  openrouter: ["openai/gpt-6-luna"],
});

describe("isAllowedAgentModel", () => {
  test("accepts a model the catalog registered for a Mots provider", () => {
    expect(isAllowedAgentModel(models, "kilo", "reflection/beam-free")).toBe(true);
    expect(isAllowedAgentModel(models, "openrouter", "openai/gpt-6-luna")).toBe(true);
  });

  test("rejects an unknown provider, a missing model, and an oversized id", () => {
    expect(isAllowedAgentModel(models, "anthropic", "claude")).toBe(false);
    expect(isAllowedAgentModel(models, "kilo", "openai/gpt-6-luna")).toBe(false);
    expect(isAllowedAgentModel(models, "kilo", "x".repeat(129))).toBe(false);
    expect(isAllowedAgentModel(models, "p".repeat(65), "reflection/beam-free")).toBe(false);
    expect(isAllowedAgentModel(models, "KILO", "reflection/beam-free")).toBe(false);
  });
});

describe("ModelNotAllowedError", () => {
  test("uses the stable command code and a generic message", () => {
    const error = new ModelNotAllowedError();
    expect(error.code).toBe(COMMAND_ERROR.modelNotAllowed);
    expect(error.message).toBe("That model is not available.");
    expect(error.message.includes("gpt")).toBe(false);
  });
});
