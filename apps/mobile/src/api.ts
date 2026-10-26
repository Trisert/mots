import { parseModelCatalog, type ModelCatalogResponse } from "@mots/protocol";
import {
  parseSessionHttpBody,
  presentSessionHttpFailure,
  readCreateToken,
  sessionCreateHeaders,
} from "./session-gate";
import { normalizeBaseUrl, parseJoinTarget } from "./url";

export { parseJoinTarget };
export type { JoinTarget } from "./url";

const PROBE_TIMEOUT_MS = 4_000;

export type SessionAccess = "open" | "unauthorized" | "unavailable" | "unknown";

export type SessionProbe = {
  readonly access: SessionAccess;
  readonly message?: string;
};

export async function createSession(
  baseUrl: string,
  token: string | undefined = readCreateToken({
    EXPO_PUBLIC_MOTS_CREATE_TOKEN: process.env.EXPO_PUBLIC_MOTS_CREATE_TOKEN,
  }),
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/sessions`, {
      method: "POST",
      headers: sessionCreateHeaders(token),
    });
  } catch {
    throw new Error("Non riesco a raggiungere il server.");
  }
  if (!response.ok) {
    const body = parseSessionHttpBody(await response.json().catch(() => undefined));
    throw new Error(
      presentSessionHttpFailure(response.status, body, "create", response.headers.get("Retry-After")),
    );
  }
  const body: unknown = await response.json();
  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as { sessionId?: unknown }).sessionId !== "string"
  ) {
    throw new Error("Il server ha restituito una sessione non valida");
  }
  return (body as { sessionId: string }).sessionId;
}

/** A plain GET returns 426 for a code the server will open, and 401 for a bad one. */
export async function probeSession(baseUrl: string, sessionId: string): Promise<SessionProbe> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${normalizeBaseUrl(baseUrl)}/api/sessions/${encodeURIComponent(sessionId)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      },
    );
    if (response.status === 426 || response.status === 101) return { access: "open" };
    const body = parseSessionHttpBody(await response.json().catch(() => undefined));
    const message = presentSessionHttpFailure(
      response.status,
      body,
      "open",
      response.headers.get("Retry-After"),
    );
    if (response.status === 401) return { access: "unauthorized", message };
    if (response.status === 429 || response.status === 503 || response.status === 403) {
      return { access: "unavailable", message };
    }
    return { access: "unknown" };
  } catch {
    return { access: "unknown" };
  } finally {
    clearTimeout(timer);
  }
}

const CATALOG_TIMEOUT_MS = 10_000;

/** The models this session can switch to, as the server offers them. Throws an Italian message. */
export async function fetchModelCatalog(baseUrl: string, sessionId: string): Promise<ModelCatalogResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CATALOG_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(
      `${normalizeBaseUrl(baseUrl)}/api/sessions/${encodeURIComponent(sessionId)}/models`,
      { method: "GET", headers: { Accept: "application/json" }, signal: controller.signal },
    );
  } catch {
    throw new Error("Non riesco a raggiungere il server.");
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 404) {
    throw new Error("Questo server non elenca ancora i modelli. Aggiornalo.");
  }
  if (!response.ok) {
    const body = parseSessionHttpBody(await response.json().catch(() => undefined));
    throw new Error(presentSessionHttpFailure(response.status, body, "open", response.headers.get("Retry-After")));
  }
  try {
    return parseModelCatalog(await response.json());
  } catch {
    throw new Error("Il server ha inviato un elenco di modelli non valido.");
  }
}
