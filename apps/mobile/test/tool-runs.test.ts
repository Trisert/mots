import { describe, expect, test } from "bun:test";
import type { TranscriptEntry } from "@mots/client";
import { collapsedRunTitle, groupToolRuns, INLINE_TOOL_LIMIT, toolLine } from "../src/tool-runs.ts";
import { englishTranslate as t } from "../src/i18n/translate.ts";

function entry(id: number, role: TranscriptEntry["role"], extra: Partial<TranscriptEntry> = {}): TranscriptEntry {
  return { id, conversationId: 1, kind: "test", role, text: "", canFork: false, ...extra };
}

const tool = (id: number, name = "web_search", isError = false) =>
  entry(id, "tool", {
    text: isError ? "timeout" : "",
    toolResult: { callId: `c${id}`, name, isError },
  });

describe("groupToolRuns", () => {
  test("joins consecutive tool results into one item", () => {
    const items = groupToolRuns([entry(1, "user", { text: "ciao" }), tool(2), tool(3), entry(4, "assistant", { text: "ok" })]);
    expect(items.map((item) => item.kind)).toEqual(["entry", "tools", "entry"]);
    const run = items[1];
    expect(run.kind === "tools" && run.tools.map((t) => t.id)).toEqual([2, 3]);
  });

  test("a silent assistant entry with tool calls does not split a run", () => {
    const calls = [{ callId: "c2", name: "web_search", args: {} }];
    const items = groupToolRuns([tool(1), entry(2, "assistant", { toolCalls: calls }), tool(3)]);
    expect(items.map((item) => item.kind)).toEqual(["tools"]);
    expect(items[0].kind === "tools" && items[0].tools.length).toBe(2);
  });

  test("an assistant entry with text ends the run", () => {
    const items = groupToolRuns([tool(1), entry(2, "assistant", { text: "Ecco" }), tool(3)]);
    expect(items.map((item) => item.kind)).toEqual(["tools", "entry", "tools"]);
  });

  test("the run key follows its first result, so it stays stable as results arrive", () => {
    const before = groupToolRuns([tool(7)]);
    const after = groupToolRuns([tool(7), tool(8)]);
    expect(before[0].key).toBe(after[0].key);
  });
});

describe("toolLine", () => {
  test("uses the Italian label and the failure text when a call failed", () => {
    expect(toolLine(tool(1, "web_search"), t)).toMatchObject({ label: "web search", isError: false });
    expect(toolLine(tool(2, "fetch_page", true), t)).toMatchObject({ label: "page", detail: "timeout", isError: true });
  });
});

describe("collapsedRunTitle", () => {
  test("counts the calls and the errors", () => {
    const runOf = (n: number, errors: number) =>
      Array.from({ length: n }, (_, i) => tool(i + 1, "web_search", i < errors));
    expect(collapsedRunTitle(runOf(1, 0), t)).toBe("Used 1 tool");
    expect(collapsedRunTitle(runOf(7, 0), t)).toBe("Used 7 tools");
    expect(collapsedRunTitle(runOf(7, 1), t)).toBe("Used 7 tools · 1 error");
    expect(collapsedRunTitle(runOf(7, 2), t)).toBe("Used 7 tools · 2 errors");
  });

  test("collapses only above the inline limit", () => {
    expect(INLINE_TOOL_LIMIT).toBe(5);
  });
});
