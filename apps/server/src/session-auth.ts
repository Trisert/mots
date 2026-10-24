import { parseSessionCapability } from "@mots/protocol";

const MINIMUM_SECRET_LENGTH = 16;

export function configuredSecret(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length < MINIMUM_SECRET_LENGTH) return undefined;
  return trimmed;
}

export function bearerToken(request: Request): string | undefined {
  const header = request.headers.get("Authorization");
  if (header === null) return undefined;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1];
}

export function secretsMatch(expected: string, presented: string): boolean {
  const expectedBytes = new TextEncoder().encode(expected);
  const presentedBytes = new TextEncoder().encode(presented);
  const length = Math.max(expectedBytes.length, presentedBytes.length);
  let diff = expectedBytes.length === presentedBytes.length ? 0 : 1;
  for (let index = 0; index < length; index += 1) {
    diff |= (expectedBytes[index] ?? 0) ^ (presentedBytes[index] ?? 0);
  }
  return diff === 0;
}

function base64Url(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function signSessionId(secret: string, sessionId: string): Promise<string> {
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(sessionId));
  return base64Url(signature);
}

/** Issue a join code. The Durable Object is not created here. */
export async function issueSessionCapability(
  secret: string,
): Promise<{ readonly sessionId: string; readonly capability: string }> {
  const sessionId = crypto.randomUUID();
  const signature = await signSessionId(secret, sessionId);
  return { sessionId, capability: `${sessionId}_${signature}` };
}

/**
 * Returns the Durable Object name when the join code was issued by this server.
 * Returns undefined for a bare uuid, a truncated signature, or a forged one.
 */
export async function verifySessionCapability(
  secret: string,
  capability: string,
): Promise<string | undefined> {
  const parsed = parseSessionCapability(capability);
  if (parsed === undefined) return undefined;
  const expected = await signSessionId(secret, parsed.sessionId);
  if (!secretsMatch(expected, parsed.signature)) return undefined;
  return parsed.sessionId;
}
