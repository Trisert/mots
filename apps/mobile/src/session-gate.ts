import type { Translate } from "./i18n/translate";

/**
 * The create token is an app-wide gate. Expo inlines `EXPO_PUBLIC_MOTS_CREATE_TOKEN`
 * into the bundle, so it is not a per-user secret. When it is unset, creation
 * sends no Authorization header and a local Worker that does not check a token
 * still accepts the request.
 */

export function readCreateToken(env: {
  readonly EXPO_PUBLIC_MOTS_CREATE_TOKEN?: string;
}): string | undefined {
  const value = env.EXPO_PUBLIC_MOTS_CREATE_TOKEN?.trim() ?? "";
  return value.length > 0 ? value : undefined;
}

export function sessionCreateHeaders(token: string | undefined): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token !== undefined) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export type SessionHttpBody = {
  readonly error?: string;
  readonly message?: string;
};

export function parseSessionHttpBody(value: unknown): SessionHttpBody {
  if (typeof value !== "object" || value === null) return {};
  const record = value as Record<string, unknown>;
  return {
    ...(typeof record.error === "string" ? { error: record.error } : {}),
    ...(typeof record.message === "string" ? { message: record.message } : {}),
  };
}

export function presentSessionHttpFailure(
  status: number,
  body: SessionHttpBody,
  purpose: "create" | "open",
  t: Translate,
  retryAfter?: string | null,
): string {
  const code = body.error;
  if (status === 401 || code === "unauthorized") {
    return purpose === "create" ? t("session.createUnauthorized") : t("session.openUnauthorized");
  }
  if (status === 429 || code === "rate_limited") {
    const seconds = retryAfter?.trim() ?? "";
    return /^\d+$/.test(seconds)
      ? t("session.rateLimitedSeconds", { seconds })
      : t("session.rateLimited");
  }
  if (code === "create_token_unconfigured") {
    return t("session.noCreateToken");
  }
  if (code === "session_secret_unconfigured") {
    return t("session.noSigningSecret");
  }
  if (status === 403 || code === "origin_not_allowed") {
    return t("session.originForbidden");
  }
  if (status === 503) {
    return t("session.serverNotReady");
  }
  return t("session.serverStatus", { status });
}
