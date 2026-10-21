import { normalizeBaseUrl } from "./config";

const SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/;

export type JoinTarget = {
  readonly sessionId: string;
  readonly baseUrl?: string;
};

export function parseJoinTarget(raw: string): JoinTarget | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  if (SESSION_ID.test(trimmed)) return { sessionId: trimmed };

  const scheme = /^mots:\/\/session\/([A-Za-z0-9_-]{1,128})/i.exec(trimmed);
  if (scheme?.[1] !== undefined) return { sessionId: scheme[1] };

  const http = /^(https?:\/\/[^/\s]+)\/sessions\/([A-Za-z0-9_-]{1,128})/i.exec(trimmed);
  if (http?.[2] !== undefined) {
    return { sessionId: http[2], baseUrl: http[1] };
  }

  const loose = /\/sessions\/([A-Za-z0-9_-]{1,128})/.exec(trimmed);
  if (loose?.[1] !== undefined) return { sessionId: loose[1] };

  return undefined;
}

export async function createSession(baseUrl: string): Promise<string> {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/sessions`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Il server ha risposto con ${response.status}`);
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
