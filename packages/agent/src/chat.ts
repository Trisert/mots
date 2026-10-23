import {
  configure,
  createRegistry,
  defineExtension,
  section,
  type HarnessOptions,
} from "@earendil-works/pi-durable";
import { forgetTool, memorySection, rememberTool } from "./memory.ts";
import {
  createMotsModels,
  DEFAULT_MODELS,
  isMotsProviderId,
  type MotsEnvironment,
  type MotsProviderId,
} from "./provider.ts";
import { DeliverScheduledInstruction } from "./schedule.ts";
import { conversationSearchExtension, searchHistoryTool } from "./search.ts";
import { createScheduleTool } from "./tools.ts";

export type MotsHarnessOptions = {
  readonly modelId?: string;
  readonly provider?: MotsProviderId;
  /** The Worker's environment; the provider API key is read from here and never leaves the Worker. */
  readonly env?: MotsEnvironment;
};

export async function createMotsHarnessOptions(
  ensureWakeupAt: (timestamp: number) => Promise<void>,
  options: MotsHarnessOptions = {},
): Promise<HarnessOptions> {
  const scheduleTool = createScheduleTool(ensureWakeupAt);
  const motsExtension = defineExtension({
    name: "mots",
    tasks: [DeliverScheduledInstruction],
    tools: [rememberTool, forgetTool, scheduleTool, searchHistoryTool],
    sections: [
      section(
        "preamble",
        () =>
          "You are Mots, a warm, sharp personal companion living in the user's pocket. " +
          "You help people think, remember, plan, and get things done. Reply in the user's language. " +
          "Be concise by default and go deeper when the user asks. " +
          "You have durable memory, reminders, and search across past conversations: " +
          "use remember for lasting facts and preferences, forget when asked to remove one, " +
          "schedule for anything that should happen later, and search_history for earlier discussions. " +
          "Never claim to have remembered, forgotten, or scheduled something unless the matching tool ran. " +
          "User messages may begin with a display name in brackets; treat it as speaker attribution.",
        { tag: false },
      ),
      section(
        "clock",
        () =>
          `Current time: ${new Date().toISOString().slice(0, 16)}Z. Unless the user states a timezone, treat times as UTC.`,
        { tag: false },
      ),
      memorySection,
    ],
  });
  const registry = createRegistry();
  registry.install(motsExtension);
  registry.install(conversationSearchExtension);
  const provider = options.provider ?? "openrouter";
  const modelId = options.modelId ?? DEFAULT_MODELS[provider];
  const models = await createMotsModels(options.env ?? {}, provider);
  const defaultAgent = {
    model: { provider, modelId },
    thinkingLevel: "off" as const,
    tools: [rememberTool, forgetTool, scheduleTool, searchHistoryTool],
  };

  return {
    models,
    registry,
    settings: {
      extensions: [motsExtension],
      documentRetentionMs: 0,
    },
    conversationCreated: (tx, conversation) =>
      conversation.owner === undefined && conversation.parent === undefined
        ? configure(tx, conversation.id, defaultAgent)
        : undefined,
  };
}
