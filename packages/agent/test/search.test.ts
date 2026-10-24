import { describe, expect, test } from "bun:test";
import type { EntryId, EntryRecord, ToolExecutionApi } from "@earendil-works/pi-durable";
import {
  MAX_SCAN_ENTRIES,
  SEARCH_HISTORY_TOOL_NAME,
  searchConversations,
  searchConversationsTool,
} from "../src/search.ts";

const context = undefined as never;

type StoredConversation = {
  readonly id: number;
  readonly owner?: { readonly conversationId: number; readonly taskId: string };
  readonly entries: readonly EntryRecord[];
};

type EntryScan = {
  readonly conversationId: number;
  readonly start: number;
  readonly limit: number;
};

function userEntry(conversationId: number, id: number, text: string): EntryRecord {
  return {
    id: id as EntryId,
    conversationId: conversationId as EntryRecord["conversationId"],
    kind: "pi.user",
    model: [{ role: "user", content: text, timestamp: 0 }],
  } as EntryRecord;
}

function assistantEntry(
  conversationId: number,
  id: number,
  text: string,
  toolName?: string,
): EntryRecord {
  const content = [
    { type: "text", text },
    ...(toolName === undefined
      ? []
      : [{ type: "toolCall", id: `call-${id}`, name: toolName, arguments: {} }]),
  ];
  return {
    id: id as EntryId,
    conversationId: conversationId as EntryRecord["conversationId"],
    kind: "pi.assistant",
    model: [{ role: "assistant", content, timestamp: 0 }],
  } as unknown as EntryRecord;
}

/** Newest first, matching the entry scan order. */
function userEntries(conversationId: number, texts: readonly string[]): EntryRecord[] {
  return texts.map((text, index) => userEntry(conversationId, texts.length - index, text));
}

function repeat(text: string, count: number): string[] {
  return Array.from({ length: count }, () => text);
}

/**
 * Conversations are stored oldest first. The search asks for descending order, and this fake honors that.
 */
function harness(conversations: readonly StoredConversation[]) {
  const entryScans: EntryScan[] = [];
  let conversationScans = 0;
  const api = {
    commit: async (
      change: (tx: {
        scanConversations: (
          query: { order?: string },
          limit: number,
          cursor?: { offset: number },
        ) => Promise<{
          items: { id: number; owner?: StoredConversation["owner"] }[];
          next?: { offset: number };
        }>;
        scanEntries: (
          query: { conversationId: number },
          limit: number,
          cursor?: { offset: number },
        ) => Promise<{ items: EntryRecord[]; next?: { offset: number } }>;
      }) => Promise<unknown>,
    ) =>
      change({
        scanConversations: async (query, limit, cursor) => {
          conversationScans += 1;
          const ordered =
            query.order === "descending" ? conversations.slice().reverse() : conversations.slice();
          const start = cursor?.offset ?? 0;
          const items = ordered.slice(start, start + limit).map((conversation) => ({
            id: conversation.id,
            ...(conversation.owner === undefined ? {} : { owner: conversation.owner }),
          }));
          const next = start + limit;
          return { items, ...(next < ordered.length ? { next: { offset: next } } : {}) };
        },
        scanEntries: async (query, limit, cursor) => {
          const start = cursor?.offset ?? 0;
          entryScans.push({ conversationId: query.conversationId, start, limit });
          const all = conversations.find((item) => item.id === query.conversationId)?.entries ?? [];
          const items = all.slice(start, start + limit);
          const next = start + limit;
          return { items, ...(next < all.length ? { next: { offset: next } } : {}) };
        },
      }),
  };
  return {
    api: api as unknown as Pick<ToolExecutionApi, "commit">,
    entryScans,
    conversationScans: () => conversationScans,
    startsFor(conversationId: number): number[] {
      return entryScans
        .filter((scan) => scan.conversationId === conversationId)
        .map((scan) => scan.start);
    },
  };
}

describe("searchConversations", () => {
  test("returns a short history in full", async () => {
    const session = harness([
      {
        id: 1,
        entries: [
          assistantEntry(1, 2, "Use Postgres for the queue"),
          userEntry(1, 1, "Which database?"),
        ],
      },
    ]);
    const result = await searchConversations(session.api, "  POSTGRES  ", context);
    expect(result.truncated).toBe(false);
    expect(result.matches).toEqual([
      {
        conversationId: 1,
        entryId: 2,
        role: "assistant",
        snippet: "Use Postgres for the queue",
      },
    ]);
    expect(session.conversationScans()).toBe(1);
  });

  test("reads an exact budget through the last entry without truncating", async () => {
    const texts = repeat("hello", MAX_SCAN_ENTRIES);
    texts[MAX_SCAN_ENTRIES - 1] = "zephyr";
    const session = harness([{ id: 1, entries: userEntries(1, texts) }]);
    const result = await searchConversations(session.api, "zephyr", context);
    expect(result.truncated).toBe(false);
    expect(result.matches.map((match) => match.entryId)).toEqual([1]);
    expect(session.entryScans).toHaveLength(Math.ceil(MAX_SCAN_ENTRIES / 50));
  });

  test("stops inside a later page once the budget is spent and keeps the newer match", async () => {
    const older = repeat("hello", MAX_SCAN_ENTRIES + 100);
    older[MAX_SCAN_ENTRIES - 1] = "ancient zephyr";
    const session = harness([
      { id: 1, entries: userEntries(1, older) },
      { id: 2, entries: [userEntry(2, 7, "zephyr is recent")] },
    ]);
    const result = await searchConversations(session.api, "zephyr", context);
    expect(result.truncated).toBe(true);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({ conversationId: 2, entryId: 7, role: "user" });
    expect(result.matches.some((match) => match.snippet.includes("ancient"))).toBe(false);
    const pageSize = session.entryScans[0]?.limit ?? 0;
    const lastFetched = Math.floor((MAX_SCAN_ENTRIES - 2) / pageSize) * pageSize;
    expect(session.startsFor(2)).toEqual([0]);
    expect(session.startsFor(1)).toContain(lastFetched);
    expect(session.startsFor(1).some((start) => start > lastFetched)).toBe(false);
  });

  test("does not truncate when the only unread conversation is owned", async () => {
    const texts = repeat("hello", MAX_SCAN_ENTRIES);
    texts[0] = "zephyr";
    const session = harness([
      {
        id: 1,
        owner: { conversationId: 9, taskId: "child" },
        entries: [userEntry(1, 1, "zephyr hidden")],
      },
      { id: 2, entries: userEntries(2, texts) },
    ]);
    const result = await searchConversations(session.api, "zephyr", context);
    expect(result.truncated).toBe(false);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.conversationId).toBe(2);
    expect(session.startsFor(1)).toEqual([]);
  });

  test("truncates when an older ownerless conversation sits past the budget", async () => {
    const owned = Array.from({ length: 49 }, (_, index) => ({
      id: index + 2,
      owner: { conversationId: 1, taskId: "child" },
      entries: [userEntry(index + 2, 1, "zephyr")],
    }));
    const session = harness([
      { id: 1, entries: [userEntry(1, 1, "zephyr in the old chat")] },
      ...owned,
      { id: 51, entries: userEntries(51, repeat("hello", MAX_SCAN_ENTRIES)) },
    ]);
    const result = await searchConversations(session.api, "zephyr", context);
    expect(result.truncated).toBe(true);
    expect(result.matches).toEqual([]);
    expect(session.startsFor(1)).toEqual([]);
    expect(session.startsFor(51)).toHaveLength(Math.ceil(MAX_SCAN_ENTRIES / 50));
    expect(session.conversationScans()).toBe(2);
  });

  test("stops at the match cap before the entry budget", async () => {
    const texts = [...repeat("postgres", 21), ...repeat("other", 2_000)];
    const session = harness([{ id: 1, entries: userEntries(1, texts) }]);
    const result = await searchConversations(session.api, "postgres", context);
    expect(result.truncated).toBe(true);
    expect(result.matches).toHaveLength(20);
    expect(session.entryScans).toHaveLength(1);
  });

  test("skips turns that invoked history search", async () => {
    const session = harness([
      {
        id: 1,
        entries: [
          assistantEntry(1, 3, "postgres in the search answer", SEARCH_HISTORY_TOOL_NAME),
          userEntry(1, 2, "find postgres"),
          userEntry(1, 1, "we run postgres in production"),
        ],
      },
    ]);
    const result = await searchConversations(session.api, "postgres", context);
    expect(result.truncated).toBe(false);
    expect(result.matches.map((match) => match.entryId)).toEqual([1]);
  });

  test("does not emit an open turn when the budget cuts off a later history-search call", async () => {
    const entries = [
      ...repeat("zephyr", MAX_SCAN_ENTRIES).map((text, index) =>
        assistantEntry(1, MAX_SCAN_ENTRIES + 3 - index, text),
      ),
      assistantEntry(1, 2, "closing the search", SEARCH_HISTORY_TOOL_NAME),
      userEntry(1, 1, "search the history"),
    ];
    const session = harness([{ id: 1, entries }]);
    const result = await searchConversations(session.api, "zephyr", context);
    expect(result).toEqual({ matches: [], truncated: true });
    expect(session.startsFor(1).some((start) => start >= MAX_SCAN_ENTRIES)).toBe(false);
  });

  test("charges inherited fork rows against the budget", async () => {
    const inherited = Array.from({ length: MAX_SCAN_ENTRIES }, (_, index) =>
      userEntry(99, index + 1, "zephyr"),
    );
    const session = harness([
      { id: 1, entries: [...inherited, userEntry(1, 1, "zephyr in this conversation")] },
    ]);
    const result = await searchConversations(session.api, "zephyr", context);
    expect(result).toEqual({ matches: [], truncated: true });
    expect(session.startsFor(1).some((start) => start >= MAX_SCAN_ENTRIES)).toBe(false);
  });

  test("ignores inherited rows when the whole fork page fits", async () => {
    const session = harness([
      {
        id: 1,
        entries: [userEntry(99, 2, "zephyr"), userEntry(1, 1, "nothing to see")],
      },
    ]);
    const result = await searchConversations(session.api, "zephyr", context);
    expect(result).toEqual({ matches: [], truncated: false });
  });

  test("rejects a blank term before reading history", async () => {
    const api = {
      commit: async () => {
        throw new Error("scanned");
      },
    } as unknown as Pick<ToolExecutionApi, "commit">;
    await expect(searchConversations(api, "   ", context)).rejects.toThrow(
      "Search term must contain text",
    );
  });

  test("the conversations tool returns the budget truncation", async () => {
    const texts = repeat("no", MAX_SCAN_ENTRIES + 1);
    texts[0] = "hello";
    const session = harness([{ id: 1, entries: userEntries(1, texts) }]);
    const result = await searchConversationsTool.execute(
      { term: "hello" },
      session.api as unknown as ToolExecutionApi,
      context,
    );
    const block = result.output?.[0];
    if (block === undefined || block.type !== "text") throw new Error("expected text output");
    const body = JSON.parse(block.text) as { truncated: boolean; matches: { entryId: number }[] };
    expect(body.truncated).toBe(true);
    expect(body.matches).toHaveLength(1);
  });
});
