import { COMMAND_ERROR } from "@mots/protocol";
import type { ModelCatalog } from "./allowlist.ts";

/** Refusal for a prompt with images sent to a model that cannot read them. The message is safe to show. */
export class ImagesNotSupportedError extends Error {
  readonly code = COMMAND_ERROR.imagesNotSupported;

  constructor() {
    super("The selected model cannot read images. Choose a model with image input.");
    this.name = "ImagesNotSupportedError";
  }
}

/** Whether the model the conversation runs on accepts image input, as the catalog declares it. */
export function modelAcceptsImages(
  models: ModelCatalog,
  provider: string,
  modelId: string,
): boolean {
  const model: unknown = models.getModel(provider, modelId);
  if (typeof model !== "object" || model === null || !("input" in model)) return false;
  const input = model.input;
  return Array.isArray(input) && input.includes("image");
}
