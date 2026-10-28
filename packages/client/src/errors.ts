export type SessionError = { readonly code: string; readonly message: string };

export const CLIENT_ERROR = {
  notConnected: "not_connected",
  connectionFailed: "connection_failed",
  emptyPrompt: "empty_prompt",
  promptTooLong: "prompt_too_long",
  invalidFrame: "invalid_frame",
} as const;
