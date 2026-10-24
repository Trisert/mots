import { describe, expect, test } from "bun:test";
import { normalizeBaseUrl, parseJoinTarget } from "../src/url.ts";

describe("normalizeBaseUrl", () => {
  test("adds http and drops a trailing slash", () => {
    expect(normalizeBaseUrl(" localhost:8787/ ")).toBe("http://localhost:8787");
  });

  test("keeps an existing scheme", () => {
    expect(normalizeBaseUrl("https://example.com/")).toBe("https://example.com");
    expect(normalizeBaseUrl("HTTP://Example.com/")).toBe("HTTP://Example.com");
  });

  test("returns empty when the field is empty", () => {
    expect(normalizeBaseUrl("   ")).toBe("");
  });
});

describe("parseJoinTarget", () => {
  test("accepts a bare session id", () => {
    expect(parseJoinTarget("abc_DEF-123")).toEqual({ sessionId: "abc_DEF-123" });
  });

  test("accepts a mots link", () => {
    expect(parseJoinTarget("mots://session/session-1")).toEqual({ sessionId: "session-1" });
  });

  test("keeps the host from an http session link", () => {
    expect(parseJoinTarget("http://192.168.1.20:8787/sessions/session-1")).toEqual({
      sessionId: "session-1",
      baseUrl: "http://192.168.1.20:8787",
    });
  });

  test("accepts a path without a host", () => {
    expect(parseJoinTarget("/sessions/session-1")).toEqual({ sessionId: "session-1" });
  });

  test("rejects empty and unrelated text", () => {
    expect(parseJoinTarget("  ")).toBeUndefined();
    expect(parseJoinTarget("non è un codice")).toBeUndefined();
  });
});
