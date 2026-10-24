/**
 * Markdown parser for Mots assistant responses and autonomous agent blocks.
 *
 * Supports inline styling (bold, italic, code) and block structures:
 * - Code blocks with language identifier (```typescript ... ```)
 * - Headings (H1, H2, H3)
 * - Blockquotes (> quote)
 * - Ordered & unordered lists (- item or 1. item)
 * - Paragraphs
 */

export type InlineRun = {
  readonly text: string;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly code: boolean;
};

export type CodeBlock = {
  readonly type: "code";
  readonly language: string;
  readonly code: string;
};

export type HeadingBlock = {
  readonly type: "heading";
  readonly level: 1 | 2 | 3;
  readonly text: string;
};

export type QuoteBlock = {
  readonly type: "quote";
  readonly runs: readonly InlineRun[];
};

export type ListItem = {
  readonly number?: number;
  readonly runs: readonly InlineRun[];
};

export type ListBlock = {
  readonly type: "list";
  readonly items: readonly ListItem[];
};

export type ParagraphBlock = {
  readonly type: "paragraph";
  readonly runs: readonly InlineRun[];
};

export type MarkdownBlock =
  | CodeBlock
  | HeadingBlock
  | QuoteBlock
  | ListBlock
  | ParagraphBlock;

const INLINE_PATTERN = /(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(`[^`\n]+`)/g;

export function parseInline(text: string): readonly InlineRun[] {
  const runs: InlineRun[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      runs.push({ text: text.slice(lastIndex, index), bold: false, italic: false, code: false });
    }
    const [whole, bold, italic, code] = match;
    if (bold !== undefined) {
      runs.push({ text: bold.slice(2, -2), bold: true, italic: false, code: false });
    } else if (italic !== undefined) {
      runs.push({ text: italic.slice(1, -1), bold: false, italic: true, code: false });
    } else if (code !== undefined) {
      runs.push({ text: code.slice(1, -1), bold: false, italic: false, code: true });
    } else {
      runs.push({ text: whole, bold: false, italic: false, code: false });
    }
    lastIndex = index + whole.length;
  }
  if (lastIndex < text.length) {
    runs.push({ text: text.slice(lastIndex), bold: false, italic: false, code: false });
  }
  return runs;
}

export function parseMarkdownBlocks(text: string): readonly MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check code fence
    const codeMatch = line.match(/^```(\w+)?/);
    if (codeMatch) {
      const language = codeMatch[1]?.toLowerCase() ?? "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].startsWith("```")) {
        i++;
      }
      blocks.push({
        type: "code",
        language,
        code: codeLines.join("\n"),
      });
      continue;
    }

    // Check heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3;
      blocks.push({
        type: "heading",
        level,
        text: headingMatch[2].trim(),
      });
      i++;
      continue;
    }

    // Check blockquote
    if (line.startsWith("> ") || line === ">") {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i].startsWith("> ") || lines[i] === ">")) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({
        type: "quote",
        runs: parseInline(quoteLines.join(" ")),
      });
      continue;
    }

    // Check list item (unordered or ordered)
    const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      const items: ListItem[] = [];
      while (i < lines.length) {
        const itemMatch = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);
        if (!itemMatch) break;
        const marker = itemMatch[2];
        const isNum = /^\d+\./.test(marker);
        items.push({
          number: isNum ? parseInt(marker, 10) : undefined,
          runs: parseInline(itemMatch[3]),
        });
        i++;
      }
      blocks.push({
        type: "list",
        items,
      });
      continue;
    }

    // Empty lines: skip
    if (line.trim().length === 0) {
      i++;
      continue;
    }

    // Paragraph
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim().length > 0 &&
      !lines[i].startsWith("```") &&
      !lines[i].match(/^#{1,3}\s+/) &&
      !lines[i].startsWith(">") &&
      !lines[i].match(/^(\s*)([-*]|\d+\.)\s+/)
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({
        type: "paragraph",
        runs: parseInline(paraLines.join("\n")),
      });
    }
  }

  return blocks;
}
