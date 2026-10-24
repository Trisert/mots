import type {
  AssistantMessage,
  Model,
  Models,
  Usage,
} from "@earendil-works/pi-ai";
import { AssistantMessageEventStream } from "@earendil-works/pi-ai/utils/event-stream";

/** Canned assistant text. The hermetic smoke test waits for this exact string. */
export const STUB_MODEL_TEXT = "stub-ok";

const usage = (): Usage => ({
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
});

const chatModel = (provider: string, id: string): Model<"openai-completions"> => ({
  id,
  name: id,
  api: "openai-completions",
  provider,
  baseUrl: "http://127.0.0.1",
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  reasoning: false,
  contextWindow: 128_000,
  maxTokens: 1_024,
});

const reply = (model: {
  readonly id: string;
  readonly provider: string;
  readonly api: AssistantMessage["api"];
}): AssistantMessage => ({
  role: "assistant",
  content: [{ type: "text", text: STUB_MODEL_TEXT }],
  api: model.api,
  provider: model.provider,
  model: model.id,
  stopReason: "stop",
  timestamp: Date.now(),
  usage: usage(),
});

const streamOf = (message: AssistantMessage): AssistantMessageEventStream => {
  const stream = new AssistantMessageEventStream();
  stream.push({ type: "done", reason: "stop", message });
  return stream;
};

const unsupported = (name: string): never => {
  throw new Error(`The stub model port does not implement ${name}.`);
};

/**
 * A local model port. `getModel` resolves whatever the session configured, and
 * `streamSimple` returns one assistant message without calling `fetch`.
 */
export function createStubModels(): Models {
  const models: Models = {
    getProviders: () => [],
    getProvider: () => undefined,
    getModels: () => [],
    getModel: (provider, id) => chatModel(provider, id),
    getModelsOfType: () => [],
    getModelOfType: ((type: string, provider: string, id: string) => {
      if (type !== "chat") return undefined;
      return chatModel(provider, id);
    }) as Models["getModelOfType"],
    getAllModels: () => [],
    refresh: async () => ({ aborted: false, errors: new Map() }),
    checkAuth: async () => undefined,
    getAvailable: async () => [],
    getAvailableOfType: async () => [],
    getAllAvailable: async () => [],
    getAuth: async () => undefined,
    login: () => unsupported("login"),
    logout: async () => undefined,
    stream: (model) => streamOf(reply(model)),
    complete: async (model) => reply(model),
    streamSimple: (model) => streamOf(reply(model)),
    completeSimple: async (model) => reply(model),
    streamDeferred: () => unsupported("streamDeferred"),
    fetchDeferred: () => unsupported("fetchDeferred"),
    cancelDeferred: async () => undefined,
    generateImages: () => unsupported("generateImages"),
    classify: () => unsupported("classify"),
  };
  return models;
}
