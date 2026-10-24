import type { Models } from "@earendil-works/pi-ai";
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
  type MotsEnvironment,
  type MotsProviderId,
} from "./provider.ts";
import { useExpoAccessToken } from "./push-token.ts";
import { DeliverScheduledInstruction } from "./schedule.ts";
import { scheduleLimitsFromEnv } from "./schedule-limits.ts";
import { conversationSearchExtension, searchHistoryTool } from "./search.ts";
import { createScheduleTool } from "./tools.ts";

export type MotsHarnessOptions = {
  readonly modelId?: string;
  readonly provider?: MotsProviderId;
  /** The Worker's environment; the provider API key is read from here and never leaves the Worker. */
  readonly env?: MotsEnvironment;
  /**
   * Replaces the catalog from `createMotsModels`. Unset keeps that catalog, including its fetches.
   * The hermetic Worker smoke passes a local stub so startup does not touch the network.
   */
  readonly models?: Models;
};

export async function createMotsHarnessOptions(
  ensureWakeupAt: (timestamp: number) => Promise<void>,
  options: MotsHarnessOptions = {},
): Promise<HarnessOptions> {
  useExpoAccessToken(options.env?.EXPO_ACCESS_TOKEN);
  const scheduleTool = createScheduleTool(ensureWakeupAt, scheduleLimitsFromEnv(options.env));
  const motsExtension = defineExtension({
    name: "mots",
    tasks: [DeliverScheduledInstruction],
    tools: [rememberTool, forgetTool, scheduleTool, searchHistoryTool],
    sections: [
      section(
        "preamble",
        () =>
          "You are Mots, an autonomous personal companion living in the user's pocket. " +
          "You help people think, plan, remember, and run automated routines. Reply in the user's language. " +
          "Be concise by default and go deeper when the user asks. " +
          "You have durable memory, autonomous routines (scheduled cronjobs where you execute tasks and report back), and search across past conversations: " +
          "use remember for lasting facts and preferences, forget when asked to remove one, " +
          "schedule for autonomous routines, scheduled cronjobs, and tasks that should happen later, and search_history for earlier discussions. " +
          "When setting up a routine or scheduled task, specify clear instructions for what you must execute. " +
          "When a scheduled routine fires, carry it out autonomously using your reasoning and tools, then report the results. " +
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
  const provider = options.provider ?? "kilo";
  const modelId = options.modelId ?? DEFAULT_MODELS[provider];
  const models = options.models ?? (await createMotsModels(options.env ?? {}, provider));
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
