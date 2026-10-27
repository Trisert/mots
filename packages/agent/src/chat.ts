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
import { fetchPageTool } from "./web.ts";
import { createWebSearchTool, WEB_SEARCH_API_KEY_ENV } from "./web-search.ts";
import { DeliverScheduledInstruction } from "./schedule.ts";
import { scheduleLimitsFromEnv } from "./schedule-limits.ts";
import { conversationSearchExtension, searchHistoryTool } from "./search.ts";
import { clockSection } from "./timezone.ts";
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
  // Without TAVILY_API_KEY, web_search answers from Exa's public endpoint, which needs no key.
  const webSearch = createWebSearchTool(options.env?.[WEB_SEARCH_API_KEY_ENV]);
  const agentTools = [
    rememberTool,
    forgetTool,
    scheduleTool,
    searchHistoryTool,
    fetchPageTool,
    webSearch,
  ];
  const motsExtension = defineExtension({
    name: "mots",
    tasks: [DeliverScheduledInstruction],
    tools: agentTools,
    sections: [
      section(
        "preamble",
        () =>
          "You are Mots, an autonomous personal companion living in the user's pocket. " +
          "You help people think, plan, remember, and run automated routines. Reply in the user's language. " +
          "Be concise by default and go deeper when the user asks. " +
          "You have durable memory, autonomous routines (scheduled cronjobs where you execute tasks and report back), and search across past conversations: " +
          "use remember for lasting facts and preferences, forget when asked to remove one, " +
          "schedule for autonomous routines, scheduled cronjobs, and tasks that should happen later, search_history for earlier discussions, " +
          "web_search for current public information, " +
          "and fetch_page to read a public web link the user shares. " +
          "When setting up a routine or scheduled task, specify clear instructions for what you must execute. " +
          "When a scheduled routine fires, carry it out autonomously using your reasoning and tools, then report the results. " +
          "Never claim to have remembered, forgotten, or scheduled something unless the matching tool ran. " +
          "User messages may begin with a display name in brackets; treat it as speaker attribution.",
        { tag: false },
      ),
      clockSection,
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
    tools: agentTools,
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
