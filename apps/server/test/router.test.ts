import { describe, expect, test } from "bun:test";
import { HTTP_ERROR, parseSessionCapability } from "@mots/protocol";
import { MemoryRateLimiter } from "../src/rate-limit.ts";
import { handleRequest, type RouterDeps, type SessionStub } from "../src/router.ts";
import { verifySessionCapability } from "../src/session-auth.ts";

const SECRET = "test-session-secret-0123456789";
const CREATE = "test-create-token-0123456789";
const CATALOG = {
  providers: [{ id: "kilo", name: "Kilo" }],
  models: [],
  default: { provider: "kilo", modelId: "reflection/beam-free" },
};

function deps(overrides: Partial<RouterDeps> = {}): {
  deps: RouterDeps;
  opened: string[];
} {
  const opened: string[] = [];
  const stub: SessionStub = {
    fetch: async () => new Response("socket", { status: 200 }),
  };
  return {
    opened,
    deps: {
      env: {
        MOTS_SESSION_SECRET: SECRET,
        MOTS_CREATE_TOKEN: CREATE,
      },
      limiter: new MemoryRateLimiter(),
      now: () => 1_700_000_000_000,
      getSession: (sessionId) => {
        opened.push(sessionId);
        return stub;
      },
      listModels: async () => CATALOG,
      ...overrides,
    },
  };
}

async function create(router: RouterDeps, origin?: string): Promise<Response> {
  return handleRequest(
    new Request("https://mots.example/api/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CREATE}`,
        ...(origin === undefined ? {} : { Origin: origin }),
      },
    }),
    router,
  );
}

describe("session gate", () => {
  test("issues a signed join code and does not create a Durable Object", async () => {
    const { deps: router, opened } = deps();
    const response = await create(router);
    expect(response.status).toBe(201);
    const body = (await response.json()) as { sessionId: string; socketPath: string };
    expect(parseSessionCapability(body.sessionId)).toBeDefined();
    expect(body.socketPath).toBe(`/api/sessions/${body.sessionId}`);
    expect(await verifySessionCapability(SECRET, body.sessionId)).toBe(
      parseSessionCapability(body.sessionId)?.sessionId,
    );
    expect(opened).toEqual([]);
  });

  test("refuses to create a session without the create token or the server secrets", async () => {
    const { deps: router, opened } = deps();
    const missing = await handleRequest(
      new Request("https://mots.example/api/sessions", { method: "POST" }),
      router,
    );
    expect(missing.status).toBe(401);
    expect(((await missing.json()) as { error: string }).error).toBe(HTTP_ERROR.unauthorized);

    const noCreate = deps({
      env: { MOTS_SESSION_SECRET: SECRET },
    });
    const unconfigured = await handleRequest(
      new Request("https://mots.example/api/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${CREATE}` },
      }),
      noCreate.deps,
    );
    expect(unconfigured.status).toBe(503);
    expect(((await unconfigured.json()) as { error: string }).error).toBe(
      HTTP_ERROR.createTokenUnconfigured,
    );
    expect(opened).toEqual([]);
    expect(noCreate.opened).toEqual([]);
  });

  test("opens the Durable Object only for a valid signature, using the uuid as its name", async () => {
    const { deps: router, opened } = deps();
    const created = await create(router);
    const capability = ((await created.json()) as { sessionId: string }).sessionId;
    const uuid = parseSessionCapability(capability)?.sessionId;
    const response = await handleRequest(
      new Request(`https://mots.example/api/sessions/${capability}`, {
        headers: { Upgrade: "websocket" },
      }),
      router,
    );
    expect(response.status).toBe(200);
    expect(opened).toEqual([uuid]);

    const forged = `${capability.slice(0, -1)}${capability.endsWith("a") ? "b" : "a"}`;
    const rejected = await handleRequest(
      new Request(`https://mots.example/api/sessions/${forged}`, {
        headers: { Upgrade: "websocket" },
      }),
      router,
    );
    expect(rejected.status).toBe(401);
    expect(opened).toEqual([uuid]);

    const bare = await handleRequest(
      new Request(`https://mots.example/api/sessions/${uuid}`, {
        headers: { Upgrade: "websocket" },
      }),
      router,
    );
    expect(bare.status).toBe(401);
    expect(opened).toEqual([uuid]);
  });

  test("rate limits session creation per address", async () => {
    const { deps: router, opened } = deps({
      env: {
        MOTS_SESSION_SECRET: SECRET,
        MOTS_CREATE_TOKEN: CREATE,
        MOTS_CREATE_LIMIT: "2",
        MOTS_CREATE_WINDOW_SECONDS: "60",
      },
    });
    expect((await create(router)).status).toBe(201);
    expect((await create(router)).status).toBe(201);
    const limited = await create(router);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("60");
    expect(((await limited.json()) as { error: string }).error).toBe(HTTP_ERROR.rateLimited);
    expect(opened).toEqual([]);
  });

  test("echoes an allowed origin and rejects the rest", async () => {
    const { deps: router } = deps({
      env: {
        MOTS_SESSION_SECRET: SECRET,
        MOTS_CREATE_TOKEN: CREATE,
        MOTS_CORS_ORIGINS: "https://mots.example, http://localhost:8081",
      },
    });
    const allowed = await create(router, "http://localhost:8081");
    expect(allowed.status).toBe(201);
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:8081");
    expect(allowed.headers.get("Vary")).toBe("Origin");

    const blocked = await create(router, "https://evil.example");
    expect(blocked.status).toBe(403);
    expect(((await blocked.json()) as { error: string }).error).toBe(HTTP_ERROR.originNotAllowed);

    const health = await handleRequest(
      new Request("https://mots.example/api/health", {
        headers: { Origin: "https://mots.example" },
      }),
      router,
    );
    expect(health.status).toBe(200);
    expect(health.headers.get("Access-Control-Allow-Origin")).toBe("https://mots.example");
  });

  test("leaves CORS open when MOTS_CORS_ORIGINS is unset", async () => {
    const { deps: router } = deps();
    const health = await handleRequest(
      new Request("https://mots.example/api/health", {
        headers: { Origin: "https://anywhere.example" },
      }),
      router,
    );
    expect(health.status).toBe(200);
    expect(health.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("model catalog route", () => {
  const models = (router: RouterDeps, code: string, method = "GET") =>
    handleRequest(
      new Request(`https://mots.example/api/sessions/${code}/models`, { method }),
      router,
    );

  test("serves the catalog to a valid join code without opening the Durable Object", async () => {
    const { deps: router, opened } = deps();
    const { sessionId } = (await (await create(router)).json()) as { sessionId: string };
    const response = await models(router, sessionId);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(CATALOG);
    expect(opened).toEqual([]);
  });

  test("refuses a forged code and other methods", async () => {
    const { deps: router } = deps();
    const { sessionId } = (await (await create(router)).json()) as { sessionId: string };
    const forged = `${sessionId.slice(0, -2)}${sessionId.endsWith("AA") ? "BB" : "AA"}`;
    expect((await models(router, forged)).status).toBe(401);
    expect((await models(router, sessionId, "POST")).status).toBe(405);
  });
});
