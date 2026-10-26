import { describe, expect, test } from "bun:test";
import type { FetchLike } from "../src/web.ts";
import {
  createWebSearchTool,
  MAX_SEARCH_QUERY_CHARACTERS,
  MAX_SNIPPET_CHARACTERS,
  searchWeb,
  TAVILY_SEARCH_URL,
  WEB_SEARCH_TOOL_NAME,
} from "../src/web-search.ts";

const context = undefined as never;
const KEY = "tvly-test-key-123";

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function recording(response: Response): { fetch: FetchLike; calls: { url: string; init?: RequestInit }[] } {
  const calls: { url: string; init?: RequestInit }[] = [];
  return {
    calls,
    fetch: async (input, init) => {
      calls.push({ url: input, init });
      return response;
    },
  };
}

describe("createWebSearchTool", () => {
  test("is offered with or without a key, and is read-only", () => {
    for (const key of [KEY, undefined, "", "   "]) {
      const tool = createWebSearchTool(key);
      expect(tool.name).toBe(WEB_SEARCH_TOOL_NAME);
      expect(tool.replay).toBe("safe");
    }
  });

  test("rejects an empty or oversized query before any request is made", async () => {
    const fake = recording(json({ results: [] }));
    const tool = createWebSearchTool(KEY, fake.fetch);
    await expect(tool.execute({ query: "   " }, {} as never, context)).rejects.toThrow(
      `between 1 and ${MAX_SEARCH_QUERY_CHARACTERS}`,
    );
    await expect(
      tool.execute({ query: "q".repeat(MAX_SEARCH_QUERY_CHARACTERS + 1) }, {} as never, context),
    ).rejects.toThrow(`between 1 and ${MAX_SEARCH_QUERY_CHARACTERS}`);
    expect(fake.calls).toEqual([]);
  });

  test("searches with the trimmed query and returns numbered results", async () => {
    const fake = recording(
      json({
        results: [
          {
            title: "Durable Objects",
            url: "https://developers.cloudflare.com/durable-objects/",
            content: "Stateful   coordination\nfor Workers.",
          },
        ],
      }),
    );
    const tool = createWebSearchTool(KEY, fake.fetch);
    const result = await tool.execute({ query: "  durable objects " }, {} as never, context);
    const text = JSON.stringify(result);
    expect(text).toContain("1. Durable Objects");
    expect(text).toContain("https://developers.cloudflare.com/durable-objects/");
    expect(text).toContain("Stateful coordination for Workers.");
    expect(JSON.stringify(result)).toContain('"results":1');
    expect(fake.calls[0]?.init?.body).toContain('"query":"durable objects"');
  });

  test("says so when nothing matches", async () => {
    const tool = createWebSearchTool(KEY, recording(json({ results: [] })).fetch);
    const result = await tool.execute({ query: "nulla" }, {} as never, context);
    expect(JSON.stringify(result)).toContain('No web results for \\"nulla\\".');
  });
});

describe("searchWeb", () => {
  test("posts to Tavily with the key in the Authorization header", async () => {
    const fake = recording(json({ results: [] }));
    await searchWeb(KEY, "pagamenti", fake.fetch);
    const call = fake.calls[0];
    expect(call?.url).toBe(TAVILY_SEARCH_URL);
    expect(call?.init?.method).toBe("POST");
    expect((call?.init?.headers as Record<string, string>).authorization).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(String(call?.init?.body))).toEqual({
      query: "pagamenti",
      max_results: 5,
      search_depth: "basic",
      include_answer: false,
    });
  });

  test("uses Tavily's keyless mode without a key", async () => {
    const fake = recording(json({ results: [] }));
    await searchWeb(undefined, "meteo", fake.fetch);
    const headers = fake.calls[0]?.init?.headers as Record<string, string>;
    expect(headers["x-tavily-access-mode"]).toBe("keyless");
    expect(headers.authorization).toBeUndefined();
  });

  test("keeps only addresses that fetch_page would read, and clips long snippets", async () => {
    const long = "x".repeat(MAX_SNIPPET_CHARACTERS + 100);
    const fake = recording(
      json({
        results: [
          { title: "Pubblico", url: "https://example.com/a", content: long },
          { title: "Privato", url: "http://192.168.1.1/admin", content: "no" },
          { title: "Schema", url: "ftp://example.com/file", content: "no" },
          { title: "Senza URL", content: "no" },
          "non un oggetto",
        ],
      }),
    );
    const results = await searchWeb(KEY, "test", fake.fetch);
    expect(results.map((result) => result.url)).toEqual(["https://example.com/a"]);
    expect(results[0]?.snippet.length).toBe(MAX_SNIPPET_CHARACTERS);
    expect(results[0]?.snippet.endsWith("…")).toBe(true);
  });

  test("names the HTTP status but never echoes the key", async () => {
    const error = await searchWeb(
      KEY,
      "test",
      recording(new Response(`invalid key ${KEY}`, { status: 401 })).fetch,
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("the search service answered with HTTP 401");
    expect((error as Error).message).not.toContain(KEY);
  });

  test("rejects a response without a results list", async () => {
    await expect(
      searchWeb(KEY, "test", recording(json({ error: "quota" })).fetch),
    ).rejects.toThrow("unexpected response");
    await expect(searchWeb(KEY, "test", recording(json(null)).fetch)).rejects.toThrow(
      "unexpected response",
    );
  });
});
