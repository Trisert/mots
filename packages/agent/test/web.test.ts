import { describe, expect, test } from "bun:test";
import {
  extractText,
  fetchPageText,
  fetchPageTool,
  isPrivateHost,
  MAX_PAGE_BYTES,
  MAX_PAGE_TEXT_CHARACTERS,
  type FetchLike,
  parseWebUrl,
} from "../src/web.ts";

const context = undefined as never;

function htmlResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
    ...init,
  });
}

function scripted(...responses: Response[]): { fetch: FetchLike; calls: string[] } {
  const calls: string[] = [];
  const queue = [...responses];
  return {
    calls,
    fetch: async (input) => {
      calls.push(input);
      const next = queue.shift();
      if (next === undefined) throw new Error(`unexpected fetch of ${input}`);
      return next;
    },
  };
}

describe("parseWebUrl", () => {
  test("accepts public http and https addresses on default ports", () => {
    expect(parseWebUrl(" https://example.com/a?b=1 ").toString()).toBe("https://example.com/a?b=1");
    expect(parseWebUrl("http://example.org").protocol).toBe("http:");
  });

  test("rejects other schemes, credentials and non-default ports", () => {
    expect(() => parseWebUrl("file:///etc/passwd")).toThrow("http or https");
    expect(() => parseWebUrl("javascript:alert(1)")).toThrow("http or https");
    expect(() => parseWebUrl("https://user:pw@example.com")).toThrow("credentials");
    expect(() => parseWebUrl("https://example.com:8443")).toThrow("default port");
    expect(() => parseWebUrl("example.com")).toThrow("absolute");
    expect(() => parseWebUrl("   ")).toThrow("between 1 and 2048");
  });

  test("rejects loopback, private and link-local hosts", () => {
    for (const url of [
      "http://localhost:80/",
      "http://127.0.0.1/",
      "http://10.1.2.3/",
      "http://192.168.0.10/",
      "http://172.20.0.1/",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/",
      "http://printer.local/",
      "http://service.internal/",
    ]) {
      expect(() => parseWebUrl(url)).toThrow("public host");
    }
  });

  test("keeps public addresses that only look close to private ones", () => {
    expect(isPrivateHost("172.32.0.1")).toBe(false);
    expect(isPrivateHost("8.8.8.8")).toBe(false);
    expect(isPrivateHost("localhost.example.com")).toBe(false);
  });
});

describe("extractText", () => {
  test("returns the title and visible text without scripts, styles or tags", () => {
    const html = `<!doctype html><html><head><title> Notizie &amp; Tech </title>
      <style>p { color: red }</style></head>
      <body><script>track()</script><!-- hidden --><h1>Titolo</h1>
      <p>Primo&nbsp;paragrafo con <a href="/x">un link</a>.</p><p>Secondo &#233; &#x41;</p></body></html>`;
    expect(extractText(html)).toEqual({
      title: "Notizie & Tech",
      text: "Titolo\nPrimo paragrafo con un link .\nSecondo é A",
    });
  });

  test("omits the title when the page has none", () => {
    expect(extractText("<p>solo testo</p>")).toEqual({ text: "solo testo" });
  });
});

describe("fetchPageText", () => {
  test("reads an HTML page into title and text", async () => {
    const fake = scripted(htmlResponse("<title>Ciao</title><p>Mondo</p>"));
    const page = await fetchPageText("https://example.com/", fake.fetch);
    expect(page).toEqual({
      url: "https://example.com/",
      title: "Ciao",
      text: "Mondo",
      truncated: false,
    });
    expect(fake.calls).toEqual(["https://example.com/"]);
  });

  test("follows a redirect only after checking the new address", async () => {
    const fake = scripted(
      new Response(null, { status: 301, headers: { location: "/nuova" } }),
      htmlResponse("<p>arrivato</p>"),
    );
    const page = await fetchPageText("https://example.com/vecchia", fake.fetch);
    expect(page.url).toBe("https://example.com/nuova");
    expect(page.text).toBe("arrivato");
  });

  test("refuses a redirect into a private host", async () => {
    const fake = scripted(
      new Response(null, { status: 302, headers: { location: "http://127.0.0.1:80/admin" } }),
    );
    await expect(fetchPageText("https://example.com/", fake.fetch)).rejects.toThrow(
      "public host",
    );
    expect(fake.calls).toEqual(["https://example.com/"]);
  });

  test("stops after too many redirects", async () => {
    const hop = () => new Response(null, { status: 302, headers: { location: "/again" } });
    const fake = scripted(hop(), hop(), hop(), hop());
    await expect(fetchPageText("https://example.com/", fake.fetch)).rejects.toThrow(
      "too many redirects",
    );
  });

  test("reports HTTP errors and non-text content", async () => {
    await expect(
      fetchPageText("https://example.com/", scripted(new Response("", { status: 404 })).fetch),
    ).rejects.toThrow("HTTP 404");
    await expect(
      fetchPageText(
        "https://example.com/a.png",
        scripted(new Response("PNG", { headers: { "content-type": "image/png" } })).fetch,
      ),
    ).rejects.toThrow("not text");
  });

  test("caps the bytes read from a page", async () => {
    const big = "a".repeat(MAX_PAGE_BYTES + 1000);
    const page = await fetchPageText(
      "https://example.com/",
      scripted(htmlResponse(`<p>${big}</p>`)).fetch,
    );
    expect(page.truncated).toBe(true);
    expect(page.text.length).toBeLessThanOrEqual(MAX_PAGE_TEXT_CHARACTERS);
  });

  test("caps the characters returned to the model", async () => {
    const page = await fetchPageText(
      "https://example.com/",
      scripted(htmlResponse(`<p>${"b".repeat(MAX_PAGE_TEXT_CHARACTERS + 50)}</p>`)).fetch,
    );
    expect(page.text.length).toBe(MAX_PAGE_TEXT_CHARACTERS);
    expect(page.truncated).toBe(true);
  });
});

describe("fetchPageTool", () => {
  test("is read-only and safe to replay", () => {
    expect(fetchPageTool.name).toBe("fetch_page");
    expect(fetchPageTool.replay).toBe("safe");
  });

  test("rejects a private address before any request is made", async () => {
    await expect(
      fetchPageTool.execute({ url: "http://192.168.1.1/" }, {} as never, context),
    ).rejects.toThrow("public host");
  });
});
