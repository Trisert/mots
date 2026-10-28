import { CLIENT_ERROR, type RunErrorCode, type SessionError } from "@mots/client";
import { COMMAND_ERROR, MAX_PROMPT_CHARACTERS, type ConnectionStatus } from "@mots/protocol";
import type { MessageKey, Translate } from "./i18n/translate";

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

const ERROR_KEYS: Readonly<Record<string, MessageKey>> = {
  [CLIENT_ERROR.notConnected]: "error.notConnected",
  [CLIENT_ERROR.connectionFailed]: "error.connectionFailed",
  [CLIENT_ERROR.emptyPrompt]: "error.emptyPrompt",
  [CLIENT_ERROR.invalidFrame]: "error.invalidFrame",
  [COMMAND_ERROR.modelNotAllowed]: "error.modelUnavailable",
  [COMMAND_ERROR.dailyLimitReached]: "error.dailyLimit",
  [COMMAND_ERROR.commandFailed]: "error.generic",
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

export function presentError(error: SessionError, t: Translate): string {
  if (error.code === CLIENT_ERROR.promptTooLong) {
    return t("error.promptTooLong", {
      count: MAX_PROMPT_CHARACTERS.toLocaleString(),
    });
  }
  const key = ERROR_KEYS[error.code];
  return key === undefined ? presentRawError(error.message, t) : t(key);
}

export function presentRawError(message: string, t: Translate): string {
  const trimmed = message.trim();
  if (trimmed.length === 0) return t("error.generic");
  return trimmed;
}

const RUN_ERRORS: Readonly<Record<RunErrorCode, MessageKey>> = {
  no_response: "run.noResponse",
};

/** Copy for a run that the client reports by code. */
export function presentRunError(code: RunErrorCode, t: Translate): string {
  return t(RUN_ERRORS[code]);
}

/**
 * `failed` is a terminal close: the client will not reconnect by itself.
 * `connecting` is the first attempt or a backoff retry. They must not share copy.
 */
export function presentConnection(
  status: ConnectionStatus,
  t: Translate,
  error?: SessionError,
): ConnectionPresentation {
  const presentedError = error === undefined ? undefined : presentError(error, t);
  switch (status) {
    case "connected":
      return {
        tone: "ok",
        label: t("connection.online"),
        title: t("connection.online"),
        body: "",
        busy: false,
        canRetry: false,
      };
    case "failed":
      return {
        tone: "danger",
        label: t("connection.offline"),
        title: t("connection.interrupted"),
        body: presentedError ?? t("connection.closedBody"),
        busy: false,
        canRetry: true,
      };
    default:
      return {
        tone: "wait",
        label: t("connection.connecting"),
        title: t("connection.connectingTitle"),
        body: presentedError ?? t("connection.checkingBody"),
        busy: true,
        canRetry: true,
      };
  }
}
