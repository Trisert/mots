import { describe, expect, test } from "bun:test";
import { createSession, probeSession } from "../src/api.ts";
import { parseJoinTarget } from "../src/url.ts";
import {
  presentSessionHttpFailure,
  readCreateToken,
  sessionCreateHeaders,
} from "../src/session-gate.ts";
import { englishTranslate as t } from "../src/i18n/translate.ts";

const JOIN_CODE = `${"a".repeat(8)}-${"b".repeat(4)}-${"c".repeat(4)}-${"d".repeat(4)}-${"e".repeat(12)}_${"A".repeat(43)}`;

describe("readCreateToken", () => {
  test("omits a missing or blank token", () => {
    expect(readCreateToken({})).toBeUndefined();
    expect(readCreateToken({ EXPO_PUBLIC_MOTS_CREATE_TOKEN: "   " })).toBeUndefined();
  });

  test("keeps a configured token", () => {
    expect(readCreateToken({ EXPO_PUBLIC_MOTS_CREATE_TOKEN: " local-gate " })).toBe("local-gate");
  });
});

describe("sessionCreateHeaders", () => {
  test("sends no Authorization header when local dev has no token", () => {
    expect(sessionCreateHeaders(undefined)).toEqual({ Accept: "application/json" });
  });

  test("sends the bearer when a token is configured", () => {
    expect(sessionCreateHeaders("gate-token")).toEqual({
      Accept: "application/json",
      Authorization: "Bearer gate-token",
    });
  });
});

describe("presentSessionHttpFailure", () => {
  test("explains a refused create and a refused join differently", () => {
    const create = presentSessionHttpFailure(401, { error: "unauthorized" }, "create", t);
    const open = presentSessionHttpFailure(401, { error: "unauthorized" }, "open", t);
    expect(create).toContain("with a code");
    expect(open).toContain("full code");
    expect(create).not.toBe(open);
  });

  test("includes Retry-After on a rate limit", () => {
    expect(presentSessionHttpFailure(429, { error: "rate_limited" }, "create", t, "30")).toBe(
      "Too many requests. Try again in 30 seconds.",
    );
  });

  test("names a missing server secret", () => {
    expect(
      presentSessionHttpFailure(503, { error: "session_secret_unconfigured" }, "open", t),
    ).toBe("The server has no session signing secret.");
  });
});

describe("join code", () => {
  test("keeps the signature instead of keeping only the uuid", () => {
    expect(JOIN_CODE.length).toBe(80);
    expect(parseJoinTarget(JOIN_CODE)).toEqual({ sessionId: JOIN_CODE });
    expect(parseJoinTarget(`https://mots.example/sessions/${JOIN_CODE}`)).toEqual({
      sessionId: JOIN_CODE,
      baseUrl: "https://mots.example",
    });
  });
});

describe("createSession", () => {
  const original = globalThis.fetch;

  test("returns the join code unchanged and omits the bearer when no token is set", async () => {
    let authorization: string | null = "present";
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      authorization = headers.get("Authorization");
      return Response.json({ sessionId: JOIN_CODE }, { status: 201 });
    }) as typeof fetch;
    try {
      await expect(createSession("http://localhost:8787", undefined)).resolves.toBe(JOIN_CODE);
      expect(authorization).toBeNull();
    } finally {
      globalThis.fetch = original;
    }
  });

  test("sends the bearer and surfaces a 401 as a join hint", async () => {
    const seen: { authorization: string | null } = { authorization: null };
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      seen.authorization = new Headers(init?.headers).get("Authorization");
      return Response.json(
        { error: "unauthorized", message: "A create token is required." },
        { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
      );
    }) as typeof fetch;
    try {
      await expect(createSession("http://127.0.0.1:8787", "gate-token")).rejects.toThrow(
        /join with a code/,
      );
      expect(seen.authorization).toBe("Bearer gate-token");
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("probeSession", () => {
  const original = globalThis.fetch;

  test("treats 426 as a code the socket may open", async () => {
    globalThis.fetch = (async () => new Response(null, { status: 426 })) as unknown as typeof fetch;
    try {
      await expect(probeSession("http://localhost:8787", JOIN_CODE)).resolves.toEqual({
        access: "open",
      });
    } finally {
      globalThis.fetch = original;
    }
  });

  test("treats 401 as a code that must be replaced", async () => {
    globalThis.fetch = (async () =>
      Response.json(
        { error: "unauthorized", message: "The session code is not valid." },
        { status: 401 },
      )) as unknown as typeof fetch;
    try {
      const result = await probeSession("http://localhost:8787", "bare-uuid");
      expect(result.access).toBe("unauthorized");
      expect(result.message).toContain("full code");
    } finally {
      globalThis.fetch = original;
    }
  });
});
