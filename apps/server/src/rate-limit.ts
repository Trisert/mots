export type RateLimitPolicy = {
  readonly createLimit: number;
  readonly createWindowMs: number;
  readonly connectLimit: number;
  readonly connectWindowMs: number;
};

export const DEFAULT_RATE_LIMIT_POLICY: RateLimitPolicy = {
  createLimit: 8,
  createWindowMs: 10 * 60 * 1000,
  connectLimit: 60,
  connectWindowMs: 60 * 1000,
};

function boundedInt(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined || value.trim().length === 0) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

export function rateLimitPolicyFromEnv(env: {
  readonly MOTS_CREATE_LIMIT?: string;
  readonly MOTS_CREATE_WINDOW_SECONDS?: string;
  readonly MOTS_CONNECT_LIMIT?: string;
  readonly MOTS_CONNECT_WINDOW_SECONDS?: string;
}): RateLimitPolicy {
  return {
    createLimit: boundedInt(env.MOTS_CREATE_LIMIT, DEFAULT_RATE_LIMIT_POLICY.createLimit, 1, 10_000),
    createWindowMs:
      boundedInt(
        env.MOTS_CREATE_WINDOW_SECONDS,
        DEFAULT_RATE_LIMIT_POLICY.createWindowMs / 1000,
        1,
        86_400,
      ) * 1000,
    connectLimit: boundedInt(
      env.MOTS_CONNECT_LIMIT,
      DEFAULT_RATE_LIMIT_POLICY.connectLimit,
      1,
      10_000,
    ),
    connectWindowMs:
      boundedInt(
        env.MOTS_CONNECT_WINDOW_SECONDS,
        DEFAULT_RATE_LIMIT_POLICY.connectWindowMs / 1000,
        1,
        86_400,
      ) * 1000,
  };
}

export type RateLimitResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly retryAfterSeconds: number };

/**
 * Per-isolate fixed window. A Cloudflare deployment has many isolates, so this slows one client
 * on one isolate. It does not replace an edge rate limit in front of a public hostname.
 */
export class MemoryRateLimiter {
  readonly #hits = new Map<string, number[]>();

  allow(bucket: string, key: string, limit: number, windowMs: number, now: number): RateLimitResult {
    const id = `${bucket}\n${key}`;
    const start = now - windowMs;
    const recent = (this.#hits.get(id) ?? []).filter((timestamp) => timestamp > start);
    if (recent.length >= limit) {
      const oldest = recent[0] ?? now;
      this.#hits.set(id, recent);
      return {
        ok: false,
        retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
      };
    }
    recent.push(now);
    this.#hits.set(id, recent);
    this.#prune(now);
    return { ok: true };
  }

  #prune(now: number): void {
    if (this.#hits.size <= 5_000) return;
    const cutoff = now - 60 * 60 * 1000;
    for (const [id, stamps] of this.#hits) {
      if (stamps.every((timestamp) => timestamp <= cutoff)) this.#hits.delete(id);
    }
  }
}

/** Cloudflare overwrites this header. Do not trust `X-Forwarded-For`. */
export function clientAddress(request: Request): string {
  const connecting = request.headers.get("CF-Connecting-IP")?.trim();
  if (connecting !== undefined && connecting.length > 0) return connecting;
  return "local";
}
