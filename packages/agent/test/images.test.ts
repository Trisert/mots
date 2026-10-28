import { describe, expect, test } from "bun:test";
import { modelAcceptsImages } from "../src/images.ts";

const catalog = (models: Record<string, unknown>) => ({
  getModel: (provider: string, id: string) => models[`${provider}/${id}`],
});

describe("modelAcceptsImages", () => {
  test("accepts a model whose catalog entry lists image input", () => {
    const models = catalog({ "kilo/vision": { input: ["text", "image"] } });
    expect(modelAcceptsImages(models, "kilo", "vision")).toBe(true);
  });

  test("refuses a text-only model, an unknown model, or a malformed entry", () => {
    const models = catalog({
      "kilo/text": { input: ["text"] },
      "kilo/broken": { input: "image" },
      "kilo/none": null,
    });
    expect(modelAcceptsImages(models, "kilo", "text")).toBe(false);
    expect(modelAcceptsImages(models, "kilo", "broken")).toBe(false);
    expect(modelAcceptsImages(models, "kilo", "none")).toBe(false);
    expect(modelAcceptsImages(models, "kilo", "missing")).toBe(false);
  });
});
