import { COMMAND_ERROR } from "@mots/protocol";
import { isMotsProviderId } from "./provider.ts";

const MAX_PROVIDER_LENGTH = 64;
const MAX_MODEL_ID_LENGTH = 128;

/** Refusal for `conversation.setModel`. The message stays generic so a probe learns nothing. */
export class ModelNotAllowedError extends Error {
  readonly code = COMMAND_ERROR.modelNotAllowed;

  constructor() {
    super("That model is not available.");
    this.name = "ModelNotAllowedError";
  }
}

export type ModelCatalog = {
  getModel(provider: string, id: string): unknown;
};

/**
 * A model may be selected only when it belongs to a Mots provider and is present in the catalog
 * the Worker actually registered. Unknown providers and invented ids are refused.
 */
export function isAllowedAgentModel(
  models: ModelCatalog,
  provider: string,
  modelId: string,
): boolean {
  if (provider.length === 0 || provider.length > MAX_PROVIDER_LENGTH) return false;
  if (modelId.length === 0 || modelId.length > MAX_MODEL_ID_LENGTH) return false;
  if (!isMotsProviderId(provider)) return false;
  return models.getModel(provider, modelId) !== undefined;
}
