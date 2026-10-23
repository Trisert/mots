import { describe, expect, test } from "bun:test";
import { parseInline } from "../src/markdown.ts";

describe("inline markdown", () => {
  test("keeps plain text as a single run", () => {
    expect(parseInline("ciao mondo")).toEqual([
      { text: "ciao mondo", bold: false, italic: false, code: false },
    ]);
  });

  test("marks bold text", () => {
    expect(parseInline("il gatto **Pixel**")).toEqual([
      { text: "il gatto ", bold: false, italic: false, code: false },
      { text: "Pixel", bold: true, italic: false, code: false },
    ]);
  });

  test("marks italic text", () => {
    expect(parseInline("un *posto* qui")).toEqual([
      { text: "un ", bold: false, italic: false, code: false },
      { text: "posto", bold: false, italic: true, code: false },
      { text: " qui", bold: false, italic: false, code: false },
    ]);
  });

  test("marks inline code", () => {
    expect(parseInline("usa `remember` adesso")).toEqual([
      { text: "usa ", bold: false, italic: false, code: false },
      { text: "remember", bold: false, italic: false, code: true },
      { text: " adesso", bold: false, italic: false, code: false },
    ]);
  });

  test("keeps the text around a match", () => {
    const runs = parseInline("a **b** c *d* e `f` g");
    expect(runs.map((run) => run.text).join("")).toBe("a b c d e f g");
  });

  test("leaves an unmatched marker as text", () => {
    expect(parseInline("2 * 3 = 6")).toEqual([
      { text: "2 * 3 = 6", bold: false, italic: false, code: false },
    ]);
  });
});
