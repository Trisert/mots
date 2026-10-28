/**
 * Join code issued by `POST /api/sessions`.
 *
 * Shape: `{uuid}_{base64url-hmac}` where the HMAC is SHA-256 over the uuid, keyed by the server
 * secret. The uuid is the Durable Object name. The signature is what makes the string a capability:
 * a client that only knows a uuid cannot open the object.
 *
 * The alphabet is `[A-Za-z0-9_-]` and the length is 80, so it fits the existing session id rule
 * of 1–128 characters from that alphabet. Do not lowercase, trim, or split it for display.
 */
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const HMAC_SHA256_BASE64URL_LENGTH = 43;

export const SESSION_CAPABILITY_PATTERN = new RegExp(
  `^(${UUID})_([A-Za-z0-9_-]{${HMAC_SHA256_BASE64URL_LENGTH}})$`,
);

export type SessionCapability = {
  /** Durable Object name. Not sufficient on its own to connect. */
  readonly sessionId: string;
  /** Signature over `sessionId`. Not a second secret the app stores separately. */
  readonly signature: string;
};

export function parseSessionCapability(value: string): SessionCapability | undefined {
  const match = SESSION_CAPABILITY_PATTERN.exec(value);
  if (match?.[1] === undefined || match[2] === undefined) return undefined;
  return { sessionId: match[1], signature: match[2] };
}

/** Stable `error` strings on HTTP JSON bodies from the Worker gate. */
export const HTTP_ERROR = {
  unauthorized: "unauthorized",
  rateLimited: "rate_limited",
  sessionSecretUnconfigured: "session_secret_unconfigured",
  createTokenUnconfigured: "create_token_unconfigured",
  originNotAllowed: "origin_not_allowed",
} as const;

/** Stable `command.result.error.code` values added for server-side refusals. */
export const COMMAND_ERROR = {
  commandFailed: "command_failed",
  modelNotAllowed: "model_not_allowed",
  imagesNotSupported: "images_not_supported",
  dailyLimitReached: "daily_limit_reached",
} as const;
