/** Groups the tool activity of a conversation into the rows the chat shows. No React Native import. */
import type { TranscriptEntry } from "@mots/client";
import type { Translate } from "./i18n/translate";
import { toolLabel, toolSummary } from "./tools";

/** Up to this many tool calls in a row are listed one by one. More collapse into one line. */
export const INLINE_TOOL_LIMIT = 5;

export type ChatItem =
  | { readonly kind: "entry"; readonly key: string; readonly entry: TranscriptEntry }
  | { readonly kind: "tools"; readonly key: string; readonly tools: readonly TranscriptEntry[] };

/**
 * An assistant entry with tool calls and no text renders nothing, so it does not end a run of
 * tool results: the calls and results of one turn stay together.
 */
function isSilent(entry: TranscriptEntry): boolean {
  return entry.role === "assistant" && entry.text.trim() === "" && (entry.toolCalls?.length ?? 0) > 0;
}

/** Consecutive tool results become one item. Everything else stays as it is. */
export function groupToolRuns(entries: readonly TranscriptEntry[]): ChatItem[] {
  const items: ChatItem[] = [];
  let run: TranscriptEntry[] = [];
  const flush = () => {
    if (run.length === 0) return;
    items.push({ kind: "tools", key: `tools-${run[0].id}`, tools: run });
    run = [];
  };
  for (const entry of entries) {
    if (entry.role === "tool") {
      run.push(entry);
    } else if (!isSilent(entry)) {
      flush();
      items.push({ kind: "entry", key: String(entry.id), entry });
    }
  }
  flush();
  return items;
}

export type ToolLine = {
  readonly name: string;
  readonly label: string;
  readonly detail?: string;
  readonly isError: boolean;
};

/** What one tool result says in a single line: its name, and what it did or why it failed. */
export function toolLine(entry: TranscriptEntry, t: Translate, localeTag = "en-GB"): ToolLine {
  const result = entry.toolResult;
  const name = result?.name ?? t("bubble.toolFallback");
  const isError = result?.isError === true;
  const detail = isError ? entry.text : toolSummary(name, result?.details, t, localeTag);
  return {
    name,
    label: toolLabel(name, t),
    ...(detail === undefined || detail.length === 0 ? {} : { detail }),
    isError,
  };
}

/** The one line that stands for a long run, such as "Used 7 tools", with the errors counted. */
export function collapsedRunTitle(tools: readonly TranscriptEntry[], t: Translate): string {
  const count = tools.length;
  const errors = tools.filter((entry) => entry.toolResult?.isError === true).length;
  const base = count === 1 ? t("runs.collapsedOne") : t("runs.collapsedMany", { count });
  if (errors === 0) return base;
  return errors === 1
    ? t("runs.errorsOne", { title: base })
    : t("runs.errorsMany", { title: base, count: errors });
}
