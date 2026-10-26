const SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/;

export type JoinTarget = {
  readonly sessionId: string;
  readonly baseUrl?: string;
};

export function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (trimmed.length === 0) return trimmed;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

/**
 * The server the app talks to before the user edits it. A bundle-time URL wins. In a browser the
 * Worker is assumed on the host that served the page, so a phone opening http://<lan>:8081 reaches
 * http://<lan>:8787 instead of its own localhost. The Android emulator reaches the computer at
 * 10.0.2.2.
 */
export function defaultApiUrl(input: {
  readonly envUrl?: string;
  readonly os: string;
  readonly webHost?: string;
}): string {
  const envUrl = input.envUrl?.trim();
  if (envUrl !== undefined && envUrl.length > 0) return normalizeBaseUrl(envUrl);
  if (input.os === "web" && input.webHost !== undefined && input.webHost.length > 0) {
    const host = input.webHost.includes(":") && !input.webHost.startsWith("[") ? `[${input.webHost}]` : input.webHost;
    return `http://${host}:8787`;
  }
  return input.os === "android" ? "http://10.0.2.2:8787" : "http://localhost:8787";
}

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
