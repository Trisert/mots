/**
 * Models the phone can ask the server to use.
 *
 * This list is a menu, not the model in use. The header pill reads the agent
 * on the conversation snapshot. The server may reject an id that is not in
 * its catalog; the pill stays on the previous model when that happens.
 * Vercel uses AI_GATEWAY_API_KEY and https://ai-gateway.vercel.sh/v1.
 */

export type ProviderModel = {
  readonly id: string;
  readonly name: string;
  readonly tag: string;
};

export type ProviderOption = {
  readonly id: string;
  readonly name: string;
  readonly endpoint: string;
  readonly details: string;
};

export const PROVIDERS: readonly ProviderOption[] = [
  {
    id: "kilo",
    name: "Kilo",
    endpoint: "api.kilo.ai/api/gateway",
    details: "KILO_API_KEY sul server",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    endpoint: "openrouter.ai/api/v1",
    details: "OPENROUTER_API_KEY sul server",
  },
  {
    id: "vercel-ai-gateway",
    name: "Vercel",
    endpoint: "ai-gateway.vercel.sh/v1",
    details: "AI_GATEWAY_API_KEY sul server",
  },
  {
    id: "nvidia",
    name: "NVIDIA",
    endpoint: "integrate.api.nvidia.com",
    details: "NVIDIA_API_KEY sul server",
  },
];

export const PROVIDER_MODELS: Readonly<Record<string, readonly ProviderModel[]>> = {
  kilo: [
    { id: "reflection/beam-free", name: "Reflection Beam", tag: "Free" },
    { id: "kilo-auto/free", name: "Kilo Auto", tag: "Free" },
    { id: "nvidia/nemotron-3.5-super-vl:free", name: "Nemotron Super VL", tag: "Free" },
    { id: "deepseek/deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash", tag: "Veloce" },
    { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", tag: "Ampio" },
  ],
  openrouter: [
    { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku", tag: "Veloce" },
    { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", tag: "Aperto" },
    { id: "google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash", tag: "Free" },
    { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", tag: "Compatto" },
  ],
  "vercel-ai-gateway": [
    { id: "reflection/beam-free", name: "Reflection Beam", tag: "Free" },
    { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", tag: "Compatto" },
    { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku", tag: "Veloce" },
  ],
  nvidia: [
    { id: "nvidia/nemotron-3.5-lightning-30b-a3b", name: "Nemotron Lightning 30B", tag: "NIM" },
    { id: "meta/llama-3.1-8b-instruct", name: "Llama 3.1 8B", tag: "Veloce" },
    { id: "meta/llama-3.3-70b-instruct", name: "Llama 3.3 70B", tag: "Ampio" },
  ],
};
