/**
 * A small inline markdown parser for the assistant's text. The model answers in markdown, and
 * showing the raw markers (`**bold**`) reads as a bug, so bold, italic and inline code are
 * recognised here and rendered as styled runs by the component.
 *
 * The parser is pure so it can be tested without a React Native runtime.
 */

export type InlineRun = {
  readonly text: string;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly code: boolean;
};

const PATTERN = /(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(`[^`\n]+`)/g;

export function parseInline(text: string): readonly InlineRun[] {
  const runs: InlineRun[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(PATTERN)) {
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
