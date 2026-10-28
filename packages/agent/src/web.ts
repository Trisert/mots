import { Type } from "@earendil-works/pi-ai";
import type { ToolRegistration } from "@earendil-works/pi-durable";

export const FETCH_PAGE_TOOL_NAME = "fetch_page";

/** Bytes read from a page before the rest is dropped, so one page cannot fill the object's memory. */
export const MAX_PAGE_BYTES = 512 * 1024;
/** Characters of extracted text returned to the model. */
export const MAX_PAGE_TEXT_CHARACTERS = 12_000;
const MAX_URL_CHARACTERS = 2048;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 10_000;
const ALLOWED_PORTS = new Set(["", "80", "443"]);

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type FetchedPage = {
  readonly url: string;
  readonly title?: string;
  readonly text: string;
  readonly truncated: boolean;
};

type FetchPageArguments = { readonly url: string };

const PRIVATE_IPV4 = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

/**
 * Literal addresses and local names that a Worker must never fetch on the user's behalf. A literal-address check
 * cannot stop DNS rebinding; a public name that resolves to a private address is a known limit in Workers.
 */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host.includes(":")) {
    if (
      host.startsWith("::") ||
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      /^fe[89ab][0-9a-f]:/.test(host) ||
      host.startsWith("64:ff9b:")
    ) {
      return true;
    }
  }
  return PRIVATE_IPV4.some((pattern) => pattern.test(host));
}

/** Accepts only public http(s) URLs on the default ports, without credentials. */
export function parseWebUrl(input: string): URL {
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_URL_CHARACTERS) {
    throw new Error("url must be between 1 and 2048 characters");
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch (error) {
    throw new Error("url must be an absolute http or https address", { cause: error });
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("url must use http or https");
  }
  if (url.username !== "" || url.password !== "") {
    throw new Error("url must not contain credentials");
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new Error("url must use the default port for its scheme");
  }
  if (isPrivateHost(url.hostname)) {
    throw new Error("url must point to a public host");
  }
  return url;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code =
        entity[1]?.toLowerCase() === "x"
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** The page title and its visible text, with scripts, styles and tags removed. */
export function extractText(html: string): { title?: string; text: string } {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleMatch ? decodeEntities(titleMatch[1]).replace(/\s+/g, " ").trim() : undefined;
  const body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(title|script|style|noscript|template|svg)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<\/?(p|div|br|li|h[1-6]|tr|section|article|header|footer)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const text = decodeEntities(body)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
  return title === undefined || title.length === 0 ? { text } : { title, text };
}

async function readCapped(response: Response, maxBytes: number): Promise<{ body: string; truncated: boolean }> {
  if (response.body === null) return { body: "", truncated: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (size + value.byteLength > maxBytes) {
      chunks.push(value.subarray(0, maxBytes - size));
      size = maxBytes;
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    size += value.byteLength;
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { body: new TextDecoder().decode(bytes), truncated };
}

/**
 * Fetches a public page and returns its readable text. Redirects are followed by hand so every hop
 * is checked against the same rules as the first address.
 */
export async function fetchPageText(
  input: string,
  fetchImpl: FetchLike = fetch,
  signal: AbortSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS),
): Promise<FetchedPage> {
  let url = parseWebUrl(input);
  for (let hop = 0; ; hop += 1) {
    const response = await fetchImpl(url.toString(), {
      redirect: "manual",
      signal,
      headers: { accept: "text/html,text/plain;q=0.9,*/*;q=0.1" },
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location !== null) {
      if (hop >= MAX_REDIRECTS) throw new Error("too many redirects");
      url = parseWebUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`the page answered with HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!/^(text\/|application\/(xhtml\+)?xml)/i.test(contentType) && contentType !== "") {
      throw new Error("the page is not text");
    }
    const { body, truncated } = await readCapped(response, MAX_PAGE_BYTES);
    const isHtml = /html|xml/i.test(contentType) || /^\s*</.test(body);
    const extracted = isHtml ? extractText(body) : { text: body.trim() };
    const text =
      extracted.text.length > MAX_PAGE_TEXT_CHARACTERS
        ? extracted.text.slice(0, MAX_PAGE_TEXT_CHARACTERS)
        : extracted.text;
    return {
      url: url.toString(),
      ...(extracted.title === undefined ? {} : { title: extracted.title }),
      text,
      truncated: truncated || text.length < extracted.text.length,
    };
  }
}

export function pageToolOutput(page: FetchedPage): string {
  const header = [
    page.title === undefined ? undefined : `Title: ${page.title}`,
    `URL: ${page.url}`,
  ].filter((line): line is string => line !== undefined);
  const note = page.truncated ? "\n[The page was cut short; only the start is shown.]" : "";
  return `${header.join("\n")}\n\n${page.text}${note}`;
}

/** Read-only, so it is safe to run twice: a replay only fetches the page again. */
export const fetchPageTool: ToolRegistration = {
  name: FETCH_PAGE_TOOL_NAME,
  description:
    "Read a public web page and return its title and visible text. Use it when the user shares a link or asks about the content of a specific page. It cannot log in, submit forms, or read private addresses.",
  parameters: Type.Object({
    url: Type.String({
      minLength: 1,
      maxLength: MAX_URL_CHARACTERS,
      description: "An absolute http or https address, e.g. https://example.com/article",
    }),
  }),
  replay: "safe",
  execute: async (args: FetchPageArguments) => {
    const page = await fetchPageText(args.url);
    return {
      output: [{ type: "text" as const, text: pageToolOutput(page) }],
      details: {
        url: page.url,
        ...(page.title === undefined ? {} : { title: page.title }),
        characters: page.text.length,
        truncated: page.truncated,
      },
    };
  },
};
