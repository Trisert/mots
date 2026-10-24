import { normalizeBaseUrl, parseJoinTarget } from "./url";

export { parseJoinTarget };
export type { JoinTarget } from "./url";

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
