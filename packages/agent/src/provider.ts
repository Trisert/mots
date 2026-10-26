import { type AuthContext, type Model, type ModelCostTier, type Provider } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { createModels, type MutableModels } from "@earendil-works/pi-ai/models";
import { nvidiaProvider } from "@earendil-works/pi-ai/providers/nvidia";
import { openrouterProvider } from "@earendil-works/pi-ai/providers/openrouter";

/**
 * The Vercel AI Gateway speaks the OpenAI dialect at `/v1`, so the Agent talks to it through Pi's
 * `openai-completions` implementation. The gateway publishes its catalog without authentication, which
 * means the model list is never stale: a model Vercel adds later works without a code change.
 */
export const VERCEL_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1";

/** The unauthenticated catalog endpoint. */
export const VERCEL_GATEWAY_MODELS_URL = "https://ai-gateway.vercel.sh/v1/models";

/**
 * A live catalog request aborts after this. Long enough for a healthy host, short enough that a
 * hung one cannot hold Durable Object startup inside `blockConcurrencyWhile`.
 */
export const CATALOG_TIMEOUT_MS = 4_000;

/** Optional fetch and timeout. Tests pass these; production leaves them unset. */
export type CatalogFetch = (
  url: string,
  init: { readonly headers: { readonly accept: string }; readonly signal: AbortSignal },
) => Promise<Response>;

export type CatalogLoadOptions = {
  readonly fetch?: CatalogFetch;
  readonly timeoutMs?: number;
};

/**
 * Kilo Gateway (https://kilo.ai) provider configuration.
 * Supported by official extension: https://github.com/Kilo-Org/kilo-pi-provider
 */
export const KILO_API_BASE = "https://api.kilo.ai";
export const KILO_GATEWAY_BASE_URL = "https://api.kilo.ai/api/gateway";
export const KILO_GATEWAY_MODELS_URL = "https://api.kilo.ai/api/gateway/models";

export const MOTS_PROVIDERS = ["kilo", "openrouter", "vercel-ai-gateway", "nvidia"] as const;

export type MotsProviderId = (typeof MOTS_PROVIDERS)[number];

export const DEFAULT_MODELS: Readonly<Record<MotsProviderId, string>> = {
  kilo: "reflection/beam-free",
  openrouter: "openai/gpt-6-luna",
  "vercel-ai-gateway": "reflection/beam-free",
  nvidia: "nvidia/nemotron-3.5-lightning-30b-a3b",
};

/** Environment variable holding the API key for each provider. */
export const API_KEY_ENV: Readonly<Record<MotsProviderId, string>> = {
  kilo: "KILO_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  "vercel-ai-gateway": "AI_GATEWAY_API_KEY",
  nvidia: "NVIDIA_API_KEY",
};

export const isMotsProviderId = (value: string): value is MotsProviderId =>
  (MOTS_PROVIDERS as readonly string[]).includes(value);

/**
 * Blank or unset stays on Kilo. Any other value must be a known provider id.
 * An unknown value throws so a typo cannot silently spend the Kilo key.
 */
export function resolveMotsProvider(value: string | undefined): MotsProviderId {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) return "kilo";
  if (isMotsProviderId(trimmed)) return trimmed;
  throw new Error("MOTS_PROVIDER is not one of kilo, openrouter, vercel-ai-gateway, nvidia");
}

/**
 * The environment values a provider may read. The Cloudflare Worker environment is not a plain
 * record, so the accepted shape is structural: any object whose values are strings.
 */
export type MotsEnvironment = Readonly<Record<string, string | undefined>>;

export type GatewayPricingTier = {
  readonly cost?: string;
  readonly min?: number;
  readonly max?: number;
};

export type GatewayModel = {
  readonly id: string;
  readonly name?: string;
  readonly context_window?: number;
  readonly max_tokens?: number;
  readonly pricing?: {
    readonly input?: string;
    readonly output?: string;
    readonly input_cache_read?: string;
    readonly input_cache_write?: string;
    readonly input_tiers?: readonly GatewayPricingTier[];
    readonly output_tiers?: readonly GatewayPricingTier[];
    readonly input_cache_read_tiers?: readonly GatewayPricingTier[];
    readonly input_cache_write_tiers?: readonly GatewayPricingTier[];
    /** When true the price depends on which upstream provider serves the request. */
    readonly varies_by_provider?: boolean;
  };
  readonly modalities?: { readonly input?: readonly string[] };
  readonly supported_parameters?: readonly string[];
  readonly reasoning_options?: {
    readonly type?: string;
    readonly values?: readonly string[];
    /** The lower bound of a budget control, in tokens. */
    readonly min?: number;
  }[];
};

/**
 * A gateway model priced at zero on both directions is free regardless of the credit balance.
 *
 * A model whose price varies by provider is excluded: the zero is only the cheapest upstream, and
 * the request may be served by one that charges. `reflection/beam` is the case in point: its
 * catalog entry says zero, while the upstream it actually lands on charges per token.
 */
export const isFreeGatewayModel = (model: GatewayModel): boolean =>
  model.pricing?.input === "0" &&
  model.pricing?.output === "0" &&
  model.pricing?.varies_by_provider !== true;

const pricePerMillion = (value: string | undefined): number => {
  if (value === undefined) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  // The gateway reports a price per token; Pi models report a price per million tokens.
  return parsed * 1_000_000;
};

/**
 * Map the gateway's tiered pricing to Pi's cost tiers.
 *
 * The gateway prices long contexts in bands: each tier has its own cost and the number of input
 * tokens it starts from. Pi expects the same shape, with the prices already per million tokens.
 */
const toCostTiers = (model: GatewayModel): ModelCostTier[] => {
  const inputTiers = model.pricing?.input_tiers ?? [];
  const outputTiers = model.pricing?.output_tiers ?? [];
  const cacheReadTiers = model.pricing?.input_cache_read_tiers ?? [];
  const cacheWriteTiers = model.pricing?.input_cache_write_tiers ?? [];
  const count = Math.max(
    inputTiers.length,
    outputTiers.length,
    cacheReadTiers.length,
    cacheWriteTiers.length,
  );
  const tiers: ModelCostTier[] = [];
  for (let index = 0; index < count; index++) {
    const input = inputTiers[index];
    const output = outputTiers[index];
    const cacheRead = cacheReadTiers[index];
    const cacheWrite = cacheWriteTiers[index];
    // The threshold is where the band starts; the first band starts at zero.
    const threshold = input?.min ?? output?.min ?? cacheRead?.min ?? cacheWrite?.min ?? 0;
    tiers.push({
      input: pricePerMillion(input?.cost),
      output: pricePerMillion(output?.cost),
      cacheRead: pricePerMillion(cacheRead?.cost),
      cacheWrite: pricePerMillion(cacheWrite?.cost),
      inputTokensAbove: threshold,
    });
  }
  return tiers;
};

/**
 * Map one gateway catalog entry to a Pi model. The gateway's `supported_parameters` decides which
 * capabilities the model has: without `tools` the Agent's memory and reminders cannot work, so such
 * models are dropped rather than silently failing at request time.
 */
export const toPiModel = (
  model: GatewayModel,
  baseUrl: string = VERCEL_GATEWAY_BASE_URL,
): Model<"openai-completions"> | undefined => {
  if (!model.supported_parameters?.includes("tools")) return undefined;
  const efforts = model.reasoning_options?.find((option) => option.type === "effort")?.values ?? [];
  // Only the models that expose an effort control accept `reasoning_effort`. The others advertise
  // "reasoning" but expose a toggle or a token budget instead, and Pi would send them an effort
  // value they do not understand.
  const supportsReasoning = model.supported_parameters.includes("reasoning") && efforts.length > 0;
  const tiers = toCostTiers(model);
  const piModel: Model<"openai-completions"> = {
    id: model.id,
    name: model.name ?? model.id,
    api: "openai-completions",
    provider: "vercel-ai-gateway",
    baseUrl,
    input: model.modalities?.input?.includes("image") ? ["text", "image"] : ["text"],
    cost: {
      input: pricePerMillion(model.pricing?.input),
      output: pricePerMillion(model.pricing?.output),
      // The gateway publishes the cache prices separately: 273 of the 482 models charge for a
      // cache read, and reporting zero would understate the cost of a cached conversation.
      cacheRead: pricePerMillion(model.pricing?.input_cache_read),
      cacheWrite: pricePerMillion(model.pricing?.input_cache_write),
      ...(tiers.length > 0 ? { tiers } : {}),
    },
    reasoning: supportsReasoning,
    contextWindow: model.context_window ?? 128_000,
    maxTokens: model.max_tokens ?? 8_192,
    type: "chat",
    compat: {
      // The gateway accepts `max_tokens`, not the OpenAI-only `max_completion_tokens`: the model
      // catalog lists `max_tokens` for every model and `max_completion_tokens` for none. The
      // `store` flag is not in the catalog either, so it is not sent.
      maxTokensField: "max_tokens",
      supportsStore: false,
      // The system prompt goes out as a `system` message. The gateway accepts `developer` too, but
      // it routes to many upstream providers that only know `system`.
      supportsDeveloperRole: false,
      supportsReasoningEffort: supportsReasoning,
    },
  };
  if (efforts.length > 0) {
    // The gateway accepts the shared effort names, but each model lists only the ones it supports:
    // 110 of the 263 effort-capable models do not offer "none", and some offer only part of the
    // ladder. A level is mapped only when the model accepts the matching effort, so Pi never sends
    // a value the model would reject.
    //
    // "off" is deliberately left unmapped: Pi would then send `reasoning_effort: "none"`, which is
    // not among the effort values this model's catalog entry lists. Leaving it unmapped means Pi
    // sends no reasoning parameter at all, which is what the level asks for.
    const ladder = ["minimal", "low", "medium", "high", "xhigh", "max"] as const;
    const effortFor: Record<(typeof ladder)[number], string> = {
      minimal: "low",
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: "xhigh",
      max: "max",
    };
    const mapped: Partial<Record<(typeof ladder)[number], string>> = {};
    for (const level of ladder) {
      const effort = effortFor[level];
      if (efforts.includes(effort)) mapped[level] = effort;
    }
    // A model that offers only part of the ladder still needs the levels it lacks to fall back to
    // a level it does support, so each unsupported level maps to the closest supported one below it.
    for (const level of ladder) {
      if (mapped[level] !== undefined) continue;
      const index = ladder.indexOf(level);
      for (let below = index - 1; below >= 0; below--) {
        const candidate = ladder[below]!;
        if (mapped[candidate] !== undefined) {
          mapped[level] = mapped[candidate]!;
          break;
        }
      }
    }
    if (Object.keys(mapped).length > 0) piModel.thinkingLevelMap = mapped;
  }
  return piModel;
};

/**
 * Build the Vercel AI Gateway provider. The model catalog comes from the gateway itself rather than
 * from Pi's bundled snapshot, so models Vercel adds later are usable without touching the code.
 */
export const vercelGatewayProvider = (
  models: readonly Model<"openai-completions">[],
): Provider<"openai-completions"> => ({
  id: "vercel-ai-gateway",
  name: "Vercel AI Gateway",
  baseUrl: VERCEL_GATEWAY_BASE_URL,
  auth: {
    apiKey: {
      name: "Vercel AI Gateway API key",
      login: async (interaction) => {
        interaction.signal.throwIfAborted();
        const key = await interaction.prompt({
          type: "secret",
          message: "Enter Vercel AI Gateway API key",
        });
        interaction.signal.throwIfAborted();
        return { type: "api_key", key };
      },
      resolve: async ({ ctx, credential, signal }) => {
        signal.throwIfAborted();
        if (credential?.key) return { auth: { apiKey: credential.key }, source: "stored credential" };
        const value = await ctx.env(API_KEY_ENV["vercel-ai-gateway"]);
        signal.throwIfAborted();
        return value
          ? { auth: { apiKey: value }, source: API_KEY_ENV["vercel-ai-gateway"] }
          : undefined;
      },
    },
  },
  getModels: () => models,
  getAllModels: () => models,
  stream: (model, context, options) => openAICompletionsApi().stream(model, context, options),
  streamSimple: (model, context, options) => openAICompletionsApi().streamSimple(model, context, options),
});

let cachedModels: readonly Model<"openai-completions">[] | undefined;
let cachedFetch: Promise<readonly Model<"openai-completions">[]> | undefined;

/** A custom fetch or timeout belongs to one test and must not stick in the isolate cache. */
const usesIsolateCache = (options?: CatalogLoadOptions): boolean =>
  options?.fetch === undefined && options?.timeoutMs === undefined;

const readCatalog = async (
  url: string,
  failure: string,
  options?: CatalogLoadOptions,
): Promise<unknown> => {
  const timeoutMs = options?.timeoutMs ?? CATALOG_TIMEOUT_MS;
  const init = {
    headers: { accept: "application/json" as const },
    signal: AbortSignal.timeout(timeoutMs),
  };
  const response = options?.fetch ? await options.fetch(url, init) : await fetch(url, init);
  if (!response.ok) throw new Error(`${failure}: ${response.status}`);
  return response.json();
};

const loadGatewayModels = async (
  options?: CatalogLoadOptions,
): Promise<readonly Model<"openai-completions">[]> => {
  const body = (await readCatalog(
    VERCEL_GATEWAY_MODELS_URL,
    "Vercel AI Gateway catalog request failed",
    options,
  )) as { readonly data?: readonly GatewayModel[] };
  return (body.data ?? [])
    .map((model) => toPiModel(model))
    .filter((model): model is Model<"openai-completions"> => model !== undefined);
};

/** Fetch the live gateway catalog, cached for the lifetime of the isolate. */
export const gatewayModels = async (
  options?: CatalogLoadOptions,
): Promise<readonly Model<"openai-completions">[]> => {
  if (!usesIsolateCache(options)) return loadGatewayModels(options);
  if (cachedModels !== undefined) return cachedModels;
  cachedFetch ??= loadGatewayModels()
    .then((models) => {
      cachedModels = models;
      return models;
    })
    .catch((error: unknown) => {
      cachedFetch = undefined;
      throw error;
    });
  return cachedFetch;
};

/** The free gateway models, for diagnostics and documentation. */
export const freeGatewayModels = async (): Promise<readonly string[]> => {
  const response = await fetch(VERCEL_GATEWAY_MODELS_URL, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Vercel AI Gateway catalog request failed: ${response.status}`);
  const body = (await response.json()) as { readonly data?: readonly GatewayModel[] };
  return (body.data ?? []).filter(isFreeGatewayModel).map((model) => model.id);
};

/**
 * Resolve the provider credentials for the given provider. The API key stays in the Worker's
 * environment and is never written to disk or sent to the client.
 */
export const providerAuthContext = (env: MotsEnvironment): AuthContext => ({
  async env(name: string): Promise<string | undefined> {
    const value = (env as Record<string, unknown>)[name];
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
  },
  async fileExists(): Promise<boolean> {
    return false;
  },
});

/** Opt-in for reading ~/.pi/agent/auth.json. Any other value leaves the file unread. */
const LOCAL_KILO_AUTH_ENV = "MOTS_ALLOW_LOCAL_KILO_AUTH";

function allowsLocalKiloAuth(value: string | undefined): boolean {
  return value?.trim() === "1";
}

/**
 * Pi stores a Kilo access token in ~/.pi/agent/auth.json. The Worker reads that file only when
 * MOTS_ALLOW_LOCAL_KILO_AUTH=1. The `require("node:fs")` call sits below that check.
 */
function readStoredKiloToken(allowLocalAuth: string | undefined): string | undefined {
  if (!allowsLocalKiloAuth(allowLocalAuth)) return undefined;
  try {
    if (typeof process === "undefined" || !process.env) return undefined;
    const home = process.env.HOME || process.env.USERPROFILE;
    if (!home) return undefined;
    const fs = require("node:fs");
    const path = require("node:path");
    const authPath = path.join(home, ".pi", "agent", "auth.json");
    if (!fs.existsSync(authPath)) return undefined;
    const auth = JSON.parse(fs.readFileSync(authPath, "utf8"));
    const token = auth?.kilo?.access;
    return typeof token === "string" && token.length > 0 ? token : undefined;
  } catch {
    return undefined;
  }
}

let loggedKiloFreeSource = false;

/** The free-tier key is intentional. Say so once per isolate, without the key. */
function logKiloFreeSource(): void {
  if (loggedKiloFreeSource) return;
  loggedKiloFreeSource = true;
  console.info("Kilo auth source: kilo-free");
}

export const toKiloPiModel = (
  model: GatewayModel,
  baseUrl: string = KILO_GATEWAY_BASE_URL,
): Model<"openai-completions"> | undefined => {
  if (model.supported_parameters && !model.supported_parameters.includes("tools")) {
    return undefined;
  }
  const supportsReasoning = Boolean(model.supported_parameters?.includes("reasoning"));
  const tiers = toCostTiers(model);
  const piModel: Model<"openai-completions"> = {
    id: model.id,
    name: model.name ?? model.id,
    api: "openai-completions",
    provider: "kilo",
    baseUrl,
    input: model.modalities?.input?.includes("image") ? ["text", "image"] : ["text"],
    cost: {
      input: pricePerMillion(model.pricing?.input),
      output: pricePerMillion(model.pricing?.output),
      cacheRead: pricePerMillion(model.pricing?.input_cache_read),
      cacheWrite: pricePerMillion(model.pricing?.input_cache_write),
      ...(tiers.length > 0 ? { tiers } : {}),
    },
    reasoning: supportsReasoning,
    contextWindow: model.context_window ?? 128_000,
    maxTokens: model.max_tokens ?? 8_192,
    type: "chat",
    compat: {
      maxTokensField: "max_tokens",
      supportsStore: false,
      supportsDeveloperRole: false,
      supportsReasoningEffort: supportsReasoning,
      thinkingFormat: "openrouter",
    },
  };
  return piModel;
};

export const kiloGatewayProvider = (
  models: readonly Model<"openai-completions">[],
): Provider<"openai-completions"> => ({
  id: "kilo",
  name: "Kilo Gateway",
  baseUrl: KILO_GATEWAY_BASE_URL,
  auth: {
    apiKey: {
      name: "Kilo Gateway API key",
      login: async (interaction) => {
        interaction.signal.throwIfAborted();
        const key = await interaction.prompt({
          type: "secret",
          message: "Enter Kilo Gateway API key",
        });
        interaction.signal.throwIfAborted();
        return { type: "api_key", key };
      },
      resolve: async ({ ctx, credential, signal }) => {
        signal.throwIfAborted();
        if (credential?.key) return { auth: { apiKey: credential.key }, source: "stored credential" };
        const value = await ctx.env(API_KEY_ENV.kilo);
        signal.throwIfAborted();
        if (value) return { auth: { apiKey: value }, source: API_KEY_ENV.kilo };
        const allowLocal = await ctx.env(LOCAL_KILO_AUTH_ENV);
        signal.throwIfAborted();
        const local = readStoredKiloToken(allowLocal);
        if (local) return { auth: { apiKey: local }, source: "~/.pi/agent/auth.json" };
        logKiloFreeSource();
        return { auth: { apiKey: "free" }, source: "kilo-free" };
      },
    },
  },
  getModels: () => models,
  getAllModels: () => models,
  stream: (model, context, options) => openAICompletionsApi().stream(model, context, options),
  streamSimple: (model, context, options) => openAICompletionsApi().streamSimple(model, context, options),
});

/** Used when the Kilo catalog times out, fails, or comes back empty. */
const KILO_FALLBACK_MODELS: readonly Model<"openai-completions">[] = [
  {
    id: "reflection/beam-free",
    name: "Reflection Beam (Free)",
    api: "openai-completions",
    provider: "kilo",
    baseUrl: KILO_GATEWAY_BASE_URL,
    input: ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    reasoning: true,
    contextWindow: 128_000,
    maxTokens: 8_192,
    type: "chat",
    compat: {
      maxTokensField: "max_tokens",
      supportsStore: false,
      supportsDeveloperRole: false,
      supportsReasoningEffort: true,
      thinkingFormat: "openrouter",
    },
  },
  {
    id: "kilo-auto/free",
    name: "Kilo Auto Free",
    api: "openai-completions",
    provider: "kilo",
    baseUrl: KILO_GATEWAY_BASE_URL,
    input: ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    reasoning: true,
    contextWindow: 128_000,
    maxTokens: 8_192,
    type: "chat",
    compat: {
      maxTokensField: "max_tokens",
      supportsStore: false,
      supportsDeveloperRole: false,
      supportsReasoningEffort: true,
      thinkingFormat: "openrouter",
    },
  },
];

type KiloCatalogEntry = {
  readonly id: string;
  readonly name?: string;
  readonly context_length?: number;
  readonly top_provider?: { readonly max_completion_tokens?: number };
  readonly max_completion_tokens?: number;
  readonly pricing?: {
    readonly prompt?: string;
    readonly completion?: string;
    readonly input_cache_read?: string;
    readonly input_cache_write?: string;
  };
  readonly architecture?: { readonly input_modalities?: readonly string[] };
  readonly supported_parameters?: readonly string[];
};

const loadKiloModels = async (
  options?: CatalogLoadOptions,
): Promise<readonly Model<"openai-completions">[]> => {
  try {
    const body = (await readCatalog(
      KILO_GATEWAY_MODELS_URL,
      "Kilo Gateway catalog request failed",
      options,
    )) as { readonly data?: readonly KiloCatalogEntry[] };
    const models = (body.data ?? [])
      .map((model) => {
        const adapted: GatewayModel = {
          id: model.id,
          name: model.name,
          context_window: model.context_length,
          max_tokens: model.top_provider?.max_completion_tokens ?? model.max_completion_tokens,
          pricing: {
            input: model.pricing?.prompt,
            output: model.pricing?.completion,
            input_cache_read: model.pricing?.input_cache_read,
            input_cache_write: model.pricing?.input_cache_write,
          },
          modalities: { input: model.architecture?.input_modalities },
          supported_parameters: model.supported_parameters,
        };
        return toKiloPiModel(adapted);
      })
      .filter((model): model is Model<"openai-completions"> => model !== undefined);
    if (models.length > 0) return models;
  } catch {
    // Timeout, HTTP error, or a payload we cannot read.
  }
  return KILO_FALLBACK_MODELS;
};

let cachedKiloModels: readonly Model<"openai-completions">[] | undefined;
let cachedKiloFetch: Promise<readonly Model<"openai-completions">[]> | undefined;

export const kiloModels = async (
  options?: CatalogLoadOptions,
): Promise<readonly Model<"openai-completions">[]> => {
  if (!usesIsolateCache(options)) return loadKiloModels(options);
  if (cachedKiloModels !== undefined) return cachedKiloModels;
  cachedKiloFetch ??= loadKiloModels()
    .then((models) => {
      cachedKiloModels = models;
      return models;
    })
    .catch((error: unknown) => {
      cachedKiloFetch = undefined;
      throw error;
    });
  return cachedKiloFetch;
};

/**
 * Register the models this session can call. Which of them a person may pick is `modelPolicy`'s call.
 *
 * - Kilo is always registered, because its free tier needs no key. Only a Kilo session fetches the
 *   live catalog; any other session gets the built-in free models, so its startup stays offline.
 * - Vercel is registered when it is selected or AI_GATEWAY_API_KEY is set, from its live catalog.
 * - OpenRouter and NVIDIA ship a bundled catalog and never touch the network.
 *
 * Live catalogs are fetched in parallel, cached per isolate, and abort after `CATALOG_TIMEOUT_MS`.
 */
export const createMotsModels = async (
  env: MotsEnvironment,
  provider: MotsProviderId,
  options?: CatalogLoadOptions,
): Promise<MutableModels> => {
  if (!isMotsProviderId(provider)) throw new Error(`Unsupported provider: ${String(provider)}`);
  const models = createModels({ authContext: providerAuthContext(env) });
  const wantsVercel =
    provider === "vercel-ai-gateway" || (env[API_KEY_ENV["vercel-ai-gateway"]]?.trim().length ?? 0) > 0;

  const [kilo, vercel] = await Promise.allSettled([
    provider === "kilo" ? kiloModels(options) : Promise.resolve(KILO_FALLBACK_MODELS),
    wantsVercel ? gatewayModels(options) : Promise.resolve(undefined),
  ]);
  try {
    if (kilo.status === "fulfilled") models.setProvider(kiloGatewayProvider(kilo.value));
  } catch {
    // kiloModels already falls back; this guards setProvider itself.
  }
  try {
    // A timed-out or failed catalog leaves Vercel unregistered. Startup does not wait longer.
    if (vercel.status === "fulfilled" && vercel.value !== undefined) {
      models.setProvider(vercelGatewayProvider(vercel.value));
    }
  } catch {
    // ignore
  }

  // Bundled catalogs. No network, so they do not delay startup for any provider.
  try {
    models.setProvider(openrouterProvider());
  } catch {
    // ignore
  }

  try {
    models.setProvider(nvidiaProvider());
  } catch {
    // ignore
  }

  return models;
};
