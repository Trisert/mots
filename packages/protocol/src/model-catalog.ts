/** `GET /api/sessions/:code/models`: the models this session can switch to. */

export type ModelCatalogProvider = {
  readonly id: string;
  readonly name: string;
};

export type ModelCatalogEntry = {
  readonly provider: string;
  readonly id: string;
  readonly name: string;
  /** Zero price on input and output. */
  readonly free: boolean;
  /** Accepts images. */
  readonly vision: boolean;
  readonly reasoning: boolean;
  /** Tokens; 0 when the catalog does not say. */
  readonly contextWindow: number;
  /** Shown first in the picker. */
  readonly recommended: boolean;
};

export type ModelCatalogResponse = {
  readonly providers: readonly ModelCatalogProvider[];
  readonly models: readonly ModelCatalogEntry[];
  /** The model a new conversation starts on. */
  readonly default: { readonly provider: string; readonly modelId: string };
};

/** Bounds keep a hostile or broken server from handing the app an unbounded list. */
export const MAX_CATALOG_MODELS = 5_000;
const MAX_TEXT = 256;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown, name: string): string => {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_TEXT) {
    throw new Error(`Model catalog ${name} is invalid`);
  }
  return value;
};

const flag = (value: unknown, name: string): boolean => {
  if (typeof value !== "boolean") throw new Error(`Model catalog ${name} is invalid`);
  return value;
};

/** Validate a catalog response. Throws `Error` on any malformed field, like the other server parsers. */
export function parseModelCatalog(value: unknown): ModelCatalogResponse {
  if (!isRecord(value) || !Array.isArray(value.providers) || !Array.isArray(value.models)) {
    throw new Error("Model catalog is invalid");
  }
  if (value.models.length > MAX_CATALOG_MODELS) throw new Error("Model catalog is too large");
  if (!isRecord(value.default)) throw new Error("Model catalog default is invalid");
  const providers = value.providers.map((provider): ModelCatalogProvider => {
    if (!isRecord(provider)) throw new Error("Model catalog provider is invalid");
    return { id: text(provider.id, "provider.id"), name: text(provider.name, "provider.name") };
  });
  const models = value.models.map((model): ModelCatalogEntry => {
    if (!isRecord(model)) throw new Error("Model catalog entry is invalid");
    const contextWindow = model.contextWindow;
    if (typeof contextWindow !== "number" || !Number.isSafeInteger(contextWindow) || contextWindow < 0) {
      throw new Error("Model catalog contextWindow is invalid");
    }
    return {
      provider: text(model.provider, "model.provider"),
      id: text(model.id, "model.id"),
      name: text(model.name, "model.name"),
      free: flag(model.free, "model.free"),
      vision: flag(model.vision, "model.vision"),
      reasoning: flag(model.reasoning, "model.reasoning"),
      contextWindow,
      recommended: flag(model.recommended, "model.recommended"),
    };
  });
  return {
    providers,
    models,
    default: {
      provider: text(value.default.provider, "default.provider"),
      modelId: text(value.default.modelId, "default.modelId"),
    },
  };
}
