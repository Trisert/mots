import { describe, expect, test } from "bun:test";
import type { ToolExecutionApi } from "@earendil-works/pi-durable";
import {
  addFact,
  forgetTool,
  matchFacts,
  MotsMemory,
  normalizeFact,
  planForget,
  rememberTool,
} from "../src/memory.ts";

const context = undefined as never;

// A fake execution API whose memory doc is a plain object the tools mutate in place.
function harness(facts: string[]) {
  const doc = { facts };
  const api = {
    commit: async (change: (tx: { doc: (token: unknown) => Promise<unknown> }) => Promise<void>) =>
      change({
        doc: async (token: unknown) => {
          if (token !== MotsMemory) throw new Error("unexpected doc");
          return doc;
        },
      }),
  };
  return { api: api as unknown as ToolExecutionApi, doc };
}

function textOf(result: unknown): string {
  return (result as { output: { text: string }[] }).output[0]?.text ?? "";
}

describe("normalizeFact", () => {
  test("trims, collapses whitespace, and lowercases", () => {
    expect(normalizeFact("  User   Likes\tTEA ")).toBe("user likes tea");
  });
});

describe("matchFacts", () => {
  test("separates exact matches from substring matches", () => {
    const facts = ["User likes  Tea", "User likes tea with milk", "Lives in Rome"];
    expect(matchFacts(facts, "  user LIKES tea ")).toEqual({ exact: [0], partial: [1] });
  });

  test("an empty query matches nothing", () => {
    expect(matchFacts(["a", "b"], "   ")).toEqual({ exact: [], partial: [] });
  });
});

describe("planForget", () => {
  test("removes every exact match and ignores partial matches when any exist", () => {
    const facts = ["Lives in Rome", "Likes  tea", "lives in ROME, Italy", "LIVES IN rome"];
    expect(planForget(facts, "lives in rome")).toEqual({ remove: [0, 3], candidates: [] });
  });

  test("removes a single substring match when the query has at least 3 characters", () => {
    expect(planForget(["Works at Acme Corp", "Likes tea"], "acme")).toEqual({
      remove: [0],
      candidates: [],
    });
  });

  test("keeps a single substring match for a query shorter than 3 characters", () => {
    expect(planForget(["Lives in Oslo"], "Os")).toEqual({ remove: [], candidates: [0] });
  });

  test("never removes an ambiguous substring match", () => {
    expect(planForget(["Likes tea", "Likes tea with milk"], "tea")).toEqual({
      remove: [],
      candidates: [0, 1],
    });
  });

  test("a one-letter query never wipes memory", () => {
    const facts = ["A cat", "A dog", "Lives in Rome"];
    expect(planForget(facts, "a")).toEqual({ remove: [], candidates: [0, 1] });
  });
});

describe("addFact", () => {
  test("appends without dropping while under the limit", () => {
    expect(addFact(["a", "b"], "c", 3)).toEqual({ facts: ["a", "b", "c"], dropped: [] });
  });

  test("drops the oldest facts when the limit would be exceeded", () => {
    expect(addFact(["a", "b", "c"], "d", 3)).toEqual({ facts: ["b", "c", "d"], dropped: ["a"] });
  });

  test("uses the 100-fact cap by default", () => {
    const facts = Array.from({ length: 100 }, (_, index) => `f${index}`);
    const next = addFact(facts, "new");
    expect(next.dropped).toEqual(["f0"]);
    expect(next.facts).toHaveLength(100);
    expect(next.facts.at(-1)).toBe("new");
  });
});

describe("remember tool", () => {
  test("reports a plain success when memory has room", async () => {
    const session = harness(["Lives in Rome"]);
    const result = await rememberTool.execute({ fact: "Likes tea" }, session.api, context);
    expect(textOf(result)).toBe("Remembered.");
    expect(result.details).toEqual({ stored: true, dropped: [] });
    expect(session.doc.facts).toEqual(["Lives in Rome", "Likes tea"]);
  });

  test("reports the oldest fact that was dropped when memory is full", async () => {
    const facts = Array.from({ length: 100 }, (_, index) => `f${index}`);
    const session = harness(facts);
    const result = await rememberTool.execute({ fact: "New fact" }, session.api, context);
    expect(textOf(result)).toBe(
      'Remembered. Memory is full, so the oldest 1 fact was dropped: "f0"',
    );
    expect(result.details).toEqual({ stored: true, dropped: ["f0"] });
    expect(session.doc.facts).toHaveLength(100);
    expect(session.doc.facts[0]).toBe("f1");
    expect(session.doc.facts.at(-1)).toBe("New fact");
  });

  test("does not store a duplicate", async () => {
    const session = harness(["Likes tea"]);
    const result = await rememberTool.execute({ fact: "likes TEA" }, session.api, context);
    expect(textOf(result)).toBe("Already remembered.");
    expect(result.details).toEqual({ stored: false, dropped: [] });
    expect(session.doc.facts).toEqual(["Likes tea"]);
  });
});

describe("forget tool", () => {
  test("removes only the exact matches and uses the plural form", async () => {
    const session = harness(["Likes tea", "likes  TEA", "Likes tea with milk"]);
    const result = await forgetTool.execute({ query: "likes tea" }, session.api, context);
    expect(textOf(result)).toBe("Forgot 2 memories.");
    expect(result.details).toEqual({ removed: 2 });
    expect(session.doc.facts).toEqual(["Likes tea with milk"]);
  });

  test("uses the singular form for one removal", async () => {
    const session = harness(["Works at Acme Corp", "Likes tea"]);
    const result = await forgetTool.execute({ query: "acme" }, session.api, context);
    expect(textOf(result)).toBe("Forgot 1 memory.");
    expect(session.doc.facts).toEqual(["Likes tea"]);
  });

  test("reports no match without changing memory", async () => {
    const session = harness(["Likes tea"]);
    const result = await forgetTool.execute({ query: "coffee" }, session.api, context);
    expect(textOf(result)).toBe("No matching memory found.");
    expect(result.details).toEqual({ removed: 0 });
    expect(session.doc.facts).toEqual(["Likes tea"]);
  });

  test("lists numbered candidates and removes nothing when the match is ambiguous", async () => {
    const session = harness(["Likes tea", "Likes tea with milk"]);
    const result = await forgetTool.execute({ query: "tea" }, session.api, context);
    expect(textOf(result)).toContain("2 memories contain that text");
    expect(textOf(result)).toContain("1. Likes tea\n2. Likes tea with milk");
    expect(textOf(result)).toContain("full exact text");
    expect(result.details).toEqual({ removed: 0 });
    expect(session.doc.facts).toEqual(["Likes tea", "Likes tea with milk"]);
  });

  test("shows at most 5 candidates", async () => {
    const facts = Array.from({ length: 7 }, (_, index) => `Note about cats ${index}`);
    const session = harness(facts);
    const text = textOf(await forgetTool.execute({ query: "cats" }, session.api, context));
    expect(text).toContain("5. Note about cats 4");
    expect(text).not.toContain("6. Note about cats 5");
    expect(text).toContain("(Showing 5 of 7.)");
    expect(session.doc.facts).toHaveLength(7);
  });

  test("a one-letter query leaves memory untouched", async () => {
    const session = harness(["A cat", "A dog", "Lives in Rome"]);
    await forgetTool.execute({ query: "a" }, session.api, context);
    expect(session.doc.facts).toEqual(["A cat", "A dog", "Lives in Rome"]);
  });

  test("replaying the same exact forget does not remove anything more", async () => {
    const session = harness(["Likes tea", "Lives in Rome", "Likes tea"]);
    await forgetTool.execute({ query: "likes tea" }, session.api, context);
    const replay = await forgetTool.execute({ query: "likes tea" }, session.api, context);
    expect(textOf(replay)).toBe("No matching memory found.");
    expect(session.doc.facts).toEqual(["Lives in Rome"]);
  });

  test("rejects a blank query", async () => {
    const session = harness(["Likes tea"]);
    await expect(forgetTool.execute({ query: "   " }, session.api, context)).rejects.toThrow(
      "The query must contain text",
    );
  });
});
