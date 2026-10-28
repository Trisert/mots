export type SessionError = { readonly code: string; readonly message: string };

export const CLIENT_ERROR = {
  notConnected: "not_connected",
  connectionFailed: "connection_failed",
  emptyPrompt: "empty_prompt",
  promptTooLong: "prompt_too_long",
  tooManyImages: "too_many_images",
  imageTooLarge: "image_too_large",
  invalidFrame: "invalid_frame",
} as const;
