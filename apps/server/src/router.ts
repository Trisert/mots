import { HTTP_ERROR } from "@mots/protocol";
import { applyCors, corsPolicyFromEnv, decideCors } from "./cors.ts";
import { clientAddress, MemoryRateLimiter, rateLimitPolicyFromEnv } from "./rate-limit.ts";
import {
  bearerToken,
  configuredSecret,
  issueSessionCapability,
  secretsMatch,
  verifySessionCapability,
} from "./session-auth.ts";

const sessionSocketRoute = /^\/api\/sessions\/([A-Za-z0-9_-]{1,128})\/?$/;

export type SessionStub = {
  fetch(request: Request): Promise<Response>;
};

export type RouterEnv = {
  readonly MOTS_SESSION_SECRET?: string;
  readonly MOTS_CREATE_TOKEN?: string;
  readonly MOTS_CORS_ORIGINS?: string;
  readonly MOTS_CREATE_LIMIT?: string;
  readonly MOTS_CREATE_WINDOW_SECONDS?: string;
  readonly MOTS_CONNECT_LIMIT?: string;
  readonly MOTS_CONNECT_WINDOW_SECONDS?: string;
};

export type RouterDeps = {
  readonly env: RouterEnv;
  readonly limiter: MemoryRateLimiter;
  readonly now: () => number;
  readonly getSession: (sessionId: string) => SessionStub;
};

const json = (body: unknown, status: number, headers?: HeadersInit): Response =>
  Response.json(body, { status, headers });

const errorBody = (error: string, message: string): { error: string; message: string } => ({
  error,
  message,
});

export async function handleRequest(request: Request, deps: RouterDeps): Promise<Response> {
  const origin = request.headers.get("Origin");
  const cors = decideCors(origin, corsPolicyFromEnv(deps.env.MOTS_CORS_ORIGINS));
  if (!cors.allow) {
    return json(
      errorBody(HTTP_ERROR.originNotAllowed, "This origin is not allowed to call Mots."),
      403,
    );
  }
  const finish = (response: Response): Response => applyCors(response, cors);

  if (request.method === "OPTIONS") {
    return finish(new Response(null, { status: 204 }));
  }

  const url = new URL(request.url);
  const policy = rateLimitPolicyFromEnv(deps.env);
  const address = clientAddress(request);

  if (url.pathname === "/api/health") {
    if (request.method !== "GET") {
      return finish(json({ error: "Method not allowed" }, 405, { Allow: "GET" }));
    }
    return finish(json({ ok: true, service: "mots" }, 200));
  }

  if (url.pathname === "/api/sessions" || url.pathname === "/api/sessions/") {
    if (request.method !== "POST") {
      return finish(json({ error: "Method not allowed" }, 405, { Allow: "POST" }));
    }
    const limited = deps.limiter.allow(
      "create",
      address,
      policy.createLimit,
      policy.createWindowMs,
      deps.now(),
    );
    if (!limited.ok) {
      return finish(
        json(
          errorBody(HTTP_ERROR.rateLimited, "Too many sessions were created from this network."),
          429,
          { "Retry-After": String(limited.retryAfterSeconds) },
        ),
      );
    }
    const sessionSecret = configuredSecret(deps.env.MOTS_SESSION_SECRET);
    if (sessionSecret === undefined) {
      return finish(
        json(
          errorBody(
            HTTP_ERROR.sessionSecretUnconfigured,
            "The server has no MOTS_SESSION_SECRET.",
          ),
          503,
        ),
      );
    }
    const createToken = configuredSecret(deps.env.MOTS_CREATE_TOKEN);
    if (createToken === undefined) {
      return finish(
        json(
          errorBody(HTTP_ERROR.createTokenUnconfigured, "The server has no MOTS_CREATE_TOKEN."),
          503,
        ),
      );
    }
    const presented = bearerToken(request);
    if (presented === undefined || !secretsMatch(createToken, presented)) {
      return finish(
        json(errorBody(HTTP_ERROR.unauthorized, "A create token is required."), 401, {
          "WWW-Authenticate": "Bearer",
        }),
      );
    }
    const issued = await issueSessionCapability(sessionSecret);
    return finish(
      json(
        {
          sessionId: issued.capability,
          url: `/sessions/${issued.capability}`,
          socketPath: `/api/sessions/${issued.capability}`,
        },
        201,
      ),
    );
  }

  const sessionMatch = sessionSocketRoute.exec(url.pathname);
  if (sessionMatch !== null) {
    const capability = sessionMatch[1]!;
    const limited = deps.limiter.allow(
      "connect",
      address,
      policy.connectLimit,
      policy.connectWindowMs,
      deps.now(),
    );
    if (!limited.ok) {
      return finish(
        json(errorBody(HTTP_ERROR.rateLimited, "Too many connection attempts."), 429, {
          "Retry-After": String(limited.retryAfterSeconds),
        }),
      );
    }
    const sessionSecret = configuredSecret(deps.env.MOTS_SESSION_SECRET);
    if (sessionSecret === undefined) {
      return finish(
        json(
          errorBody(
            HTTP_ERROR.sessionSecretUnconfigured,
            "The server has no MOTS_SESSION_SECRET.",
          ),
          503,
        ),
      );
    }
    const sessionId = await verifySessionCapability(sessionSecret, capability);
    if (sessionId === undefined) {
      return finish(
        json(errorBody(HTTP_ERROR.unauthorized, "The session code is not valid."), 401),
      );
    }
    if (request.method !== "GET") {
      return finish(json({ error: "Method not allowed" }, 405, { Allow: "GET" }));
    }
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return finish(json({ error: "WebSocket upgrade required" }, 426, { Upgrade: "websocket" }));
    }
    // Do not copy this response. Workers attaches the accepted socket on the object itself,
    // and a new Response() drops it.
    return deps.getSession(sessionId).fetch(request);
  }

  return finish(json({ error: "Not found" }, 404));
}
