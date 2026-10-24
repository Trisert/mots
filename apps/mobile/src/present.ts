import type { ConnectionStatus } from "@mots/protocol";

/** Enough of the server agent to read the model it actually configured. */
export type AgentModelSource = {
  readonly model?: {
    readonly provider: string;
    readonly modelId: string;
  };
};

export type PresentedModel = {
  readonly provider: string;
  readonly modelId: string;
  readonly shortName: string;
};

export type ConnectionTone = "ok" | "wait" | "danger";

export type ConnectionPresentation = {
  readonly tone: ConnectionTone;
  readonly label: string;
  readonly title: string;
  readonly body: string;
  readonly busy: boolean;
  readonly canRetry: boolean;
};

const PROVIDER_LABELS: Readonly<Record<string, string>> = {
  kilo: "Kilo",
  openrouter: "OpenRouter",
  "vercel-ai-gateway": "Vercel",
  nvidia: "NVIDIA",
};

const KNOWN_ERRORS: Readonly<Record<string, string>> = {
  "The session is not connected": "La sessione non è connessa.",
  "The session connection failed": "La connessione con la sessione non è riuscita.",
  "The session connection failed.": "La connessione con la sessione non è riuscita.",
  "A prompt must contain text": "Scrivi un messaggio prima di inviare.",
  "Server sent a binary protocol frame.": "Il server ha inviato un messaggio non valido.",
  "Server sent an invalid protocol frame.": "Il server ha inviato un messaggio non valido.",
  "That model is not available.": "Quel modello non è disponibile su questo server.",
};

export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

export function shortModelName(modelId: string): string {
  const slash = modelId.lastIndexOf("/");
  const short = (slash >= 0 ? modelId.slice(slash + 1) : modelId).trim();
  return short.length > 0 ? short : modelId.trim();
}

/**
 * The header pill must use this, not a model the phone guessed.
 * Undefined means the server has not reported one yet.
 */
export function presentModel(agent: AgentModelSource | undefined): PresentedModel | undefined {
  const model = agent?.model;
  if (model === undefined) return undefined;
  const provider = model.provider.trim();
  const modelId = model.modelId.trim();
  if (provider.length === 0 || modelId.length === 0) return undefined;
  return { provider, modelId, shortName: shortModelName(modelId) };
}

export function presentError(message: string): string {
  const trimmed = message.trim();
  if (trimmed.length === 0) return "Qualcosa non ha funzionato.";
  const known = KNOWN_ERRORS[trimmed];
  if (known !== undefined) return known;
  const length = /^A prompt cannot exceed ([\d,]+) characters$/.exec(trimmed);
  if (length?.[1] !== undefined) {
    return `Un messaggio non può superare ${length[1]} caratteri.`;
  }
  return trimmed;
}

/**
 * `failed` is a terminal close: the client will not reconnect by itself.
 * `connecting` is the first attempt or a backoff retry. They must not share copy.
 */
export function presentConnection(
  status: ConnectionStatus,
  rawError?: string,
): ConnectionPresentation {
  const error = rawError === undefined ? undefined : presentError(rawError);
  switch (status) {
    case "connected":
      return {
        tone: "ok",
        label: "In linea",
        title: "In linea",
        body: "",
        busy: false,
        canRetry: false,
      };
    case "failed":
      return {
        tone: "danger",
        label: "Non in linea",
        title: "Connessione interrotta",
        body: error ?? "Il collegamento si è chiuso. Puoi riprovare.",
        busy: false,
        canRetry: true,
      };
    default:
      return {
        tone: "wait",
        label: "Connessione…",
        title: "Mi collego",
        body: error ?? "Controllo che il server risponda.",
        busy: true,
        canRetry: true,
      };
  }
}
