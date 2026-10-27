import { beforeEach, describe, expect, test } from "bun:test";
import type { FetchLike } from "../src/web.ts";
import {
  createWebSearchTool,
  EXA_MCP_URL,
  MAX_SEARCH_QUERY_CHARACTERS,
  MAX_SNIPPET_CHARACTERS,
  PARALLEL_MCP_URL,
  resetKeylessRing,
  searchWeb,
  TAVILY_SEARCH_URL,
  WEB_SEARCH_TOOL_NAME,
} from "../src/web-search.ts";

const context = undefined as never;
const KEY = "tvly-test-key-123";

beforeEach(() => resetKeylessRing());

/** Two readable results and one private address, in Exa's text format. */
const EXA_TEXT = [
  "Title: Durable Objects",
  "URL: https://developers.cloudflare.com/durable-objects/",
  "Published: 2025-01-01",
  "Author: Cloudflare",
  "Highlights:",
  "Stateful coordination",
  "for Workers.",
  "---",
  "Title: Privato",
  "URL: http://192.168.1.1/admin",
  "Highlights:",
  "no",
  "---",
  "Title: Secondo",
  "URL: https://example.org/b",
  "Highlights:",
  "Un altro risultato.",
].join("\n");

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

/** Exa's JSON-RPC answer as a plain JSON body. */
function mcpJson(text: string): Response {
  return json({ jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text }] } });
}

/** The same answer framed as a server-sent event, which Exa also uses. */
function mcpSse(text: string): Response {
  const envelope = { jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text }] } };
  return new Response(`event: message\r\ndata: ${JSON.stringify(envelope)}\r\n\r\n`, {
    headers: { "content-type": "text/event-stream" },
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

  test("uses Exa when no key is set", async () => {
    const fake = recording(mcpJson(EXA_TEXT));
    const tool = createWebSearchTool(undefined, fake.fetch);
    const result = await tool.execute({ query: "durable objects" }, {} as never, context);
    expect(fake.calls[0]?.url).toBe(EXA_MCP_URL);
    expect(JSON.stringify(result)).toContain("1. Durable Objects");
  });

  test("says so when nothing matches", async () => {
    const tool = createWebSearchTool(KEY, recording(json({ results: [] })).fetch);
    const result = await tool.execute({ query: "nulla" }, {} as never, context);
    expect(JSON.stringify(result)).toContain('No web results for \\"nulla\\".');
  });
});

describe("searchWeb with a key", () => {
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

describe("searchWeb without a key", () => {
  test("posts a JSON-RPC search to Exa with no credentials", async () => {
    const fake = recording(mcpJson("No results."));
    await searchWeb(undefined, "meteo", fake.fetch);
    const call = fake.calls[0];
    expect(call?.url).toBe(EXA_MCP_URL);
    expect(call?.init?.method).toBe("POST");
    expect((call?.init?.headers as Record<string, string>).authorization).toBeUndefined();
    expect(JSON.parse(String(call?.init?.body))).toEqual({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "web_search_exa", arguments: { query: "meteo", numResults: 5 } },
    });
  });

  test("parses Exa's text blocks and drops addresses fetch_page would refuse", async () => {
    const results = await searchWeb(undefined, "x", recording(mcpJson(EXA_TEXT)).fetch);
    expect(results).toEqual([
      {
        title: "Durable Objects",
        url: "https://developers.cloudflare.com/durable-objects/",
        snippet: "Stateful coordination for Workers.",
      },
      { title: "Secondo", url: "https://example.org/b", snippet: "Un altro risultato." },
    ]);
  });

  test("reads an SSE answer as well as a JSON one", async () => {
    const results = await searchWeb(undefined, "x", recording(mcpSse(EXA_TEXT)).fetch);
    expect(results.map((result) => result.url)).toEqual([
      "https://developers.cloudflare.com/durable-objects/",
      "https://example.org/b",
    ]);
  });

  test("reports an Exa tool error, such as a rate limit", async () => {
    // A fresh Response per call: Exa's body is read before Parallel is tried.
    const limited: FetchLike = async () =>
      json({
        jsonrpc: "2.0",
        id: 1,
        result: { isError: true, content: [{ type: "text", text: "rate limit exceeded" }] },
      });
    await expect(searchWeb(undefined, "x", limited)).rejects.toThrow("rate limit exceeded");
  });

  test("reports an HTTP error from Exa", async () => {
    await expect(
      searchWeb(undefined, "x", recording(new Response("busy", { status: 429 })).fetch),
    ).rejects.toThrow("HTTP 429");
  });

  test("fails over to Parallel when Exa is rate limited", async () => {
    const calls: string[] = [];
    const fetchByUrl: FetchLike = async (input) => {
      calls.push(input);
      if (input === EXA_MCP_URL) return new Response("busy", { status: 429 });
      return mcpJson(
        JSON.stringify({
          results: [{ title: "Parallel", url: "https://example.net/p", excerpts: ["Un", "estratto."] }],
        }),
      );
    };
    const results = await searchWeb(undefined, "x", fetchByUrl);
    expect(calls).toEqual([EXA_MCP_URL, PARALLEL_MCP_URL]);
    expect(results).toEqual([{ title: "Parallel", url: "https://example.net/p", snippet: "Un estratto." }]);
  });

  test("sends Parallel the objective, the query and a session id, with no credentials", async () => {
    const fake = recording(mcpJson(JSON.stringify({ results: [] })));
    const throttled = recording(new Response("", { status: 503 }));
    await searchWeb(undefined, "meteo", async (input, init) => {
      if (input === EXA_MCP_URL) return throttled.fetch(input, init);
      return fake.fetch(input, init);
    });
    const call = fake.calls[0];
    expect(call?.url).toBe(PARALLEL_MCP_URL);
    const body = JSON.parse(String(call?.init?.body)) as {
      params: { name: string; arguments: Record<string, unknown> };
    };
    expect(body.params.name).toBe("web_search");
    expect(body.params.arguments).toMatchObject({ objective: "meteo", search_queries: ["meteo"] });
    expect(typeof body.params.arguments.session_id).toBe("string");
    expect((call?.init?.headers as Record<string, string>).authorization).toBeUndefined();
  });

  test("does not fail over on an error that is not a throttle or a refusal", async () => {
    const calls: string[] = [];
    const fetchByUrl: FetchLike = async (input) => {
      calls.push(input);
      return new Response("bad query", { status: 400 });
    };
    await expect(searchWeb(undefined, "x", fetchByUrl)).rejects.toThrow("HTTP 400");
    expect(calls).toEqual([EXA_MCP_URL]);
  });

  test("rotates the first backend between requests", async () => {
    const calls: string[] = [];
    const fetchOk: FetchLike = async (input) => {
      calls.push(input);
      return input === EXA_MCP_URL ? mcpJson(EXA_TEXT) : mcpJson(JSON.stringify({ results: [] }));
    };
    await searchWeb(undefined, "uno", fetchOk);
    await searchWeb(undefined, "due", fetchOk);
    expect(calls).toEqual([EXA_MCP_URL, PARALLEL_MCP_URL]);
  });

  test("tries each backend once, then reports the last error without looping", async () => {
    const calls: string[] = [];
    const fetchThrottled: FetchLike = async (input) => {
      calls.push(input);
      return new Response("busy", { status: 429 });
    };
    await expect(searchWeb(undefined, "x", fetchThrottled)).rejects.toThrow("HTTP 429");
    expect(calls).toEqual([EXA_MCP_URL, PARALLEL_MCP_URL]);
  });

  test("rejects an envelope with no text", async () => {
    const empty = json({ jsonrpc: "2.0", id: 1, result: { content: [] } });
    await expect(searchWeb(undefined, "x", recording(empty).fetch)).rejects.toThrow("no text");
  });
});

describe("web_search failures", () => {
  test("returns a failed search as output so the model can report the reason", async () => {
    const forbidden: FetchLike = async () => new Response("denied", { status: 403 });
    const tool = createWebSearchTool(undefined, forbidden);
    const result = await tool.execute({ query: "razzo" }, context, context);
    const text = result.output?.[0]?.type === "text" ? result.output[0].text : "";
    expect(text).toContain("HTTP 403");
    expect(text).toContain("Do not say you have no web access");
    expect(result.details).toEqual({ query: "razzo", results: 0 });
  });

  test("identifies itself to the keyless endpoints", async () => {
    const agents: (string | undefined)[] = [];
    const forbidden: FetchLike = async (_url, init) => {
      agents.push((init?.headers as Record<string, string> | undefined)?.["user-agent"]);
      return new Response("denied", { status: 403 });
    };
    await expect(searchWeb(undefined, "x", forbidden)).rejects.toThrow("HTTP 403");
    expect(agents).toEqual(["mots-agent", "mots-agent"]);
  });
});
