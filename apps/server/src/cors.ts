export type CorsPolicy = "*" | readonly string[];

export function corsPolicyFromEnv(value: string | undefined): CorsPolicy {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0 || trimmed === "*") return "*";
  const origins = trimmed
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  return origins.length === 0 ? "*" : origins;
}

export type CorsDecision =
  | { readonly allow: true; readonly origin: string | null }
  | { readonly allow: false };

/** Missing `Origin` is a non-browser client and is allowed. A presented origin must be listed. */
export function decideCors(originHeader: string | null, policy: CorsPolicy): CorsDecision {
  if (policy === "*") return { allow: true, origin: "*" };
  if (originHeader === null || originHeader.trim().length === 0) {
    return { allow: true, origin: null };
  }
  const origin = originHeader.trim();
  if (!policy.includes(origin)) return { allow: false };
  return { allow: true, origin };
}

export function applyCors(response: Response, decision: Extract<CorsDecision, { allow: true }>): Response {
  if (decision.origin === null) return response;
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", decision.origin);
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (decision.origin !== "*") headers.set("Vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
