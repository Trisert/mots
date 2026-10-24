import { describe, expect, test } from "bun:test";
import { parseInline, parseMarkdownBlocks } from "../src/markdown.ts";

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

describe("block markdown", () => {
  test("parses headings", () => {
    const blocks = parseMarkdownBlocks("# Titolo Principale\n## Sottotitolo");
    expect(blocks).toEqual([
      { type: "heading", level: 1, text: "Titolo Principale" },
      { type: "heading", level: 2, text: "Sottotitolo" },
    ]);
  });

  test("parses code blocks with language", () => {
    const blocks = parseMarkdownBlocks("```typescript\nconst a = 1;\nconsole.log(a);\n```");
    expect(blocks).toEqual([
      {
        type: "code",
        language: "typescript",
        code: "const a = 1;\nconsole.log(a);",
      },
    ]);
  });

  test("parses blockquotes", () => {
    const blocks = parseMarkdownBlocks("> Questa è una citazione\n> importante");
    expect(blocks).toEqual([
      {
        type: "quote",
        runs: [
          { text: "Questa è una citazione importante", bold: false, italic: false, code: false },
        ],
      },
    ]);
  });

  test("parses unordered and ordered lists", () => {
    const blocks = parseMarkdownBlocks("- Primo punto\n- Secondo punto\n\n1. Passo uno\n2. Passo due");
    expect(blocks).toEqual([
      {
        type: "list",
        items: [
          { number: undefined, runs: [{ text: "Primo punto", bold: false, italic: false, code: false }] },
          { number: undefined, runs: [{ text: "Secondo punto", bold: false, italic: false, code: false }] },
        ],
      },
      {
        type: "list",
        items: [
          { number: 1, runs: [{ text: "Passo uno", bold: false, italic: false, code: false }] },
          { number: 2, runs: [{ text: "Passo due", bold: false, italic: false, code: false }] },
        ],
      },
    ]);
  });
});
