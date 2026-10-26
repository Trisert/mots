import type { ModelCatalogResponse, ModelCatalogEntry } from "@mots/protocol";
import {
  API_KEY_ENV,
  DEFAULT_MODELS,
  MOTS_PROVIDERS,
  type MotsEnvironment,
  type MotsProviderId,
} from "./provider.ts";

/** Display names, kept next to the ids so the app never has to guess them. */
export const PROVIDER_NAMES: Readonly<Record<MotsProviderId, string>> = {
  kilo: "Kilo",
  openrouter: "OpenRouter",
  "vercel-ai-gateway": "Vercel AI Gateway",
  nvidia: "NVIDIA",
};

/**
 * Picks shown first in the app, in this order, when the provider actually offers them. The
 * provider's default model always comes first. Ids that a catalog drops simply disappear.
 */
const RECOMMENDED: Readonly<Record<MotsProviderId, readonly string[]>> = {
  kilo: ["reflection/beam-free", "kilo-auto/free"],
  openrouter: [
    "anthropic/claude-sonnet-5.5",
    "anthropic/claude-haiku-5.5",
    "google/gemini-3.8-flash",
    "deepseek/deepseek-v4.1-flash",
    "moonshotai/kimi-k3",
  ],
  "vercel-ai-gateway": [
    "reflection/beam-free",
    "anthropic/claude-sonnet-5.5",
    "anthropic/claude-haiku-5.5",
    "openai/gpt-6-luna",
  ],
  nvidia: [],
};

/**
 * Which providers a session may switch to, and on which ones only free models work. A provider
 * counts when its key is set, or when it is the one MOTS_PROVIDER selects. Kilo is always usable:
 * without a key it falls back to its free tier, so only its free models are offered.
 */
export type ModelPolicy = {
  readonly selected: MotsProviderId;
  /** MOTS_MODEL when set, otherwise the selected provider's default. */
  readonly defaultModelId: string;
  readonly providers: readonly MotsProviderId[];
  readonly freeOnly: readonly MotsProviderId[];
};

const hasValue = (value: string | undefined): boolean => (value?.trim().length ?? 0) > 0;

export function modelPolicy(env: MotsEnvironment, selected: MotsProviderId): ModelPolicy {
  const providers = MOTS_PROVIDERS.filter(
    (provider) => provider === selected || provider === "kilo" || hasValue(env[API_KEY_ENV[provider]]),
  );
  const freeOnly: MotsProviderId[] = hasValue(env[API_KEY_ENV.kilo]) ? [] : ["kilo"];
  const configured = env.MOTS_MODEL?.trim() ?? "";
  const defaultModelId = configured.length > 0 ? configured : DEFAULT_MODELS[selected];
  return { selected, defaultModelId, providers, freeOnly };
}

/** The slice of a Pi model this module reads. */
export type CatalogSourceModel = {
  readonly id: string;
  readonly name?: string;
  readonly input?: readonly string[];
  readonly reasoning?: boolean;
  readonly contextWindow?: number;
  readonly cost?: { readonly input?: number; readonly output?: number };
};

export type CatalogSource = {
  getModels(provider: string): readonly CatalogSourceModel[];
};

const isFree = (model: CatalogSourceModel): boolean =>
  model.cost?.input === 0 && model.cost?.output === 0;

/**
 * Batch endpoints and floating `~…-latest` aliases are not chat models a person should pick: the
 * first answers hours later, the second changes under the user without notice.
 */
const isPickable = (model: CatalogSourceModel): boolean =>
  !model.id.endsWith(":batch") && !model.id.startsWith("~");

/** True when `modelId` is a model this session offers on `provider`. */
export function isOfferedModel(
  source: CatalogSource,
  policy: ModelPolicy,
  provider: string,
  modelId: string,
): boolean {
  const known = policy.providers.find((candidate) => candidate === provider);
  if (known === undefined) return false;
  const model = source.getModels(known).find((candidate) => candidate.id === modelId);
  if (model === undefined || !isPickable(model)) return false;
  return !policy.freeOnly.includes(known) || isFree(model);
}

/**
 * Everything the app's model picker shows. Recommended models come first for each provider, then
 * the rest by name. Only models Mots can actually call are listed.
 */
export function modelCatalog(source: CatalogSource, policy: ModelPolicy): ModelCatalogResponse {
  const models: ModelCatalogEntry[] = [];
  for (const provider of policy.providers) {
    const freeOnly = policy.freeOnly.includes(provider);
    const first = provider === policy.selected ? policy.defaultModelId : DEFAULT_MODELS[provider];
    const picks = [first, ...RECOMMENDED[provider].filter((id) => id !== first)];
    const offered = source
      .getModels(provider)
      .filter((model) => isPickable(model) && (!freeOnly || isFree(model)));
    const rank = (id: string): number => {
      const index = picks.indexOf(id);
      return index < 0 ? picks.length : index;
    };
    const sorted = [...offered].sort(
      (a, b) => rank(a.id) - rank(b.id) || (a.name ?? a.id).localeCompare(b.name ?? b.id),
    );
    for (const model of sorted) {
      models.push({
        provider,
        id: model.id,
        name: model.name ?? model.id,
        // NVIDIA's bundled catalog prices everything at zero; that is its trial credit, not a
        // free model, so it never earns the badge.
        free: provider !== "nvidia" && isFree(model),
        vision: model.input?.includes("image") === true,
        reasoning: model.reasoning === true,
        contextWindow: model.contextWindow ?? 0,
        recommended: rank(model.id) < picks.length,
      });
    }
  }
  return {
    providers: policy.providers.map((id) => ({ id, name: PROVIDER_NAMES[id] })),
    models,
    default: { provider: policy.selected, modelId: policy.defaultModelId },
  };
}
