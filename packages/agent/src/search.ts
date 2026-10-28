import type { Context } from "@earendil-works/chord";
import { type AssistantMessage, Type } from "@earendil-works/pi-ai";
import {
  AssistantEntry,
  configure,
  type ConversationId,
  type ConversationRecord,
  type Cursor,
  defineExtension,
  type EntryRecord,
  type ToolExecutionApi,
  type ToolRegistration,
  UserEntry,
} from "@earendil-works/pi-durable";
import { messageText } from "./message-text.ts";

export const SEARCH_CONVERSATIONS_TOOL_NAME = "search_conversations";
export const SEARCH_HISTORY_TOOL_NAME = "search_history";

const PAGE_SIZE = 50;
const MAX_MATCHES = 20;
/** Rows read from ownerless transcripts for one search. Inherited fork rows count; the page was already read. */
export const MAX_SCAN_ENTRIES = 500;
const SNIPPET_RADIUS = 80;
/** Newest conversations first, so the entry budget is spent on recent history. */
const CONVERSATIONS_NEWEST_FIRST = { order: "descending" } as const;

export type ConversationMatch = {
  readonly conversationId: number;
  readonly entryId: number;
  readonly role: "user" | "assistant";
  readonly snippet: string;
};

function snippet(text: string, index: number, length: number): string {
  const start = Math.max(0, index - SNIPPET_RADIUS);
  const end = Math.min(text.length, index + length + SNIPPET_RADIUS);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

function invokesHistorySearch(entry: EntryRecord): boolean {
  if (!AssistantEntry.is(entry)) return false;
  return (
    entry.model?.some(
      (message) =>
        message.role === "assistant" &&
        message.content.some(
          (part) => part.type === "toolCall" && part.name === SEARCH_HISTORY_TOOL_NAME,
        ),
    ) ?? false
  );
}

function match(entry: EntryRecord, term: string): ConversationMatch | undefined {
  const role = UserEntry.is(entry) ? "user" : AssistantEntry.is(entry) ? "assistant" : undefined;
  if (role === undefined) return undefined;
  const text = messageText(entry.model?.[0]);
  const index = text.toLowerCase().indexOf(term);
  if (index === -1) return undefined;
  return {
    conversationId: entry.conversationId,
    entryId: entry.id,
    role,
    snippet: snippet(text, index, term.length),
  };
}

type ConversationPage = {
  readonly items: readonly ConversationRecord[];
  readonly next?: Cursor;
};

/**
 * True when scan order still has an ownerless conversation after `conversationIndex`. Reads conversation rows only,
 * never entries, so the entry budget stays closed while `truncated` stays honest about leftover history.
 */
async function ownerlessRemains(
  api: Pick<ToolExecutionApi, "commit">,
  context: Context,
  page: ConversationPage,
  conversationIndex: number,
): Promise<boolean> {
  for (let index = conversationIndex + 1; index < page.items.length; index++) {
    if (page.items[index]?.owner === undefined) return true;
  }
  let cursor = page.next;
  while (cursor !== undefined) {
    const pageCursor = cursor;
    const nextPage = await api.commit(
      (tx) => tx.scanConversations(CONVERSATIONS_NEWEST_FIRST, PAGE_SIZE, pageCursor),
      context,
    );
    if (nextPage.items.some((item) => item.owner === undefined)) return true;
    cursor = nextPage.next;
  }
  return false;
}

/**
 * Case-insensitive substring search over ordinary turns in ownerless conversations. Owned conversations (subagents)
 * and every turn that invokes history search are skipped, so search questions and answers derived from earlier searches never
 * become evidence. Each page is read in its own commit so a scan never holds the Session's commit line for long.
 * The scan reads at most MAX_SCAN_ENTRIES rows, newest conversations first. `truncated` is true when the match
 * cap or that budget stops the scan before ownerless history is exhausted.
 */
export async function searchConversations(
  api: Pick<ToolExecutionApi, "commit">,
  term: string,
  context: Context,
): Promise<{ readonly matches: readonly ConversationMatch[]; readonly truncated: boolean }> {
  const needle = term.trim().toLowerCase();
  if (needle.length === 0) throw new Error("Search term must contain text");
  const matches: ConversationMatch[] = [];
  const appendTurn = (turn: readonly EntryRecord[]): boolean => {
    if (turn.some(invokesHistorySearch)) return false;
    for (const entry of turn) {
      const found = match(entry, needle);
      if (found === undefined) continue;
      if (matches.length === MAX_MATCHES) return true;
      matches.push(found);
    }
    return false;
  };
  let scannedEntries = 0;
  let conversationCursor: Cursor | undefined;
  do {
    const pageCursor = conversationCursor;
    const conversations = await api.commit(
      (tx) => tx.scanConversations(CONVERSATIONS_NEWEST_FIRST, PAGE_SIZE, pageCursor),
      context,
    );
    for (let conversationIndex = 0; conversationIndex < conversations.items.length; conversationIndex++) {
      const conversation = conversations.items[conversationIndex];
      if (conversation === undefined || conversation.owner !== undefined) continue;
      let turn: EntryRecord[] = [];
      let entryCursor: Cursor | undefined;
      do {
        const entryPageCursor = entryCursor;
        const entries = await api.commit(
          (tx) =>
            tx.scanEntries({ conversationId: conversation.id }, PAGE_SIZE, entryPageCursor),
          context,
        );
        for (let index = 0; index < entries.items.length; index++) {
          const entry = entries.items[index];
          if (entry === undefined) continue;
          scannedEntries += 1;
          // A fork page repeats inherited history. Those rows are not matches, and they still spend the budget.
          if (entry.conversationId === conversation.id) {
            // Entries are newest-first. Reaching the user entry completes one whole turn.
            turn.push(entry);
            if (UserEntry.is(entry)) {
              if (appendTurn(turn)) return { matches, truncated: true };
              turn = [];
            }
          }
          if (scannedEntries >= MAX_SCAN_ENTRIES) {
            const unreadInConversation =
              index + 1 < entries.items.length || entries.next !== undefined;
            // An open turn stays unmatched: a later row could still be the search_history call that excludes it.
            if (unreadInConversation) return { matches, truncated: true };
            if (appendTurn(turn)) return { matches, truncated: true };
            if (await ownerlessRemains(api, context, conversations, conversationIndex)) {
              return { matches, truncated: true };
            }
            return { matches, truncated: false };
          }
        }
        entryCursor = entries.next;
      } while (entryCursor !== undefined);
      if (appendTurn(turn)) return { matches, truncated: true };
    }
    conversationCursor = conversations.next;
  } while (conversationCursor !== undefined);
  return { matches, truncated: false };
}

export const searchConversationsTool: ToolRegistration = {
  name: SEARCH_CONVERSATIONS_TOOL_NAME,
  description:
    "Find user and assistant messages containing a term in ordinary top-level conversation turns. " +
    `Case-insensitive substring match; returns at most ${MAX_MATCHES} matches with snippets. ` +
    `Reads at most ${MAX_SCAN_ENTRIES} entries, newest conversations first, and sets truncated when history remains.`,
  parameters: Type.Object({
    term: Type.String({ description: "Word or phrase to find, for example postgres" }),
  }),
  replay: "safe",
  execute: async (args, api, context) => {
    const { term } = args as { term: string };
    const result = await searchConversations(api, term, context);
    return { output: [{ type: "text", text: JSON.stringify(result) }] };
  },
};

export const conversationSearchExtension = defineExtension({
  name: "conversation-search",
  tools: [searchConversationsTool],
});

/**
 * Delegates a history search to a subagent: a child conversation owned by this tool call, which searches with
 * `search_conversations` and answers. The parent receives only the answer, not the raw matches.
 */
export const searchHistoryTool: ToolRegistration = {
  name: SEARCH_HISTORY_TOOL_NAME,
  description:
    "Search ordinary conversation turns in this session to answer a question about earlier discussions. " +
    "A subagent searches the conversations and replies with a short answer that cites conversation IDs.",
  parameters: Type.Object({
    question: Type.String({ description: "What to find out from past conversations" }),
  }),
  // Safe to rerun after a crash: a rerun finds the child it created and the submission it made.
  replay: "safe",
  execute: async (args, api, context) => {
    const { question } = args as { question: string };
    const childId: ConversationId = await api.commit(async (tx) => {
      // Ownership is the durable record of the child, so a rerun reuses it instead of creating another.
      const existing = (await tx.scanConversations({ ownerTaskId: api.taskId }, 1)).items[0];
      if (existing !== undefined) return existing.id;
      const child = await tx.createConversation({
        ownership: { kind: "task", taskId: api.taskId },
      });
      await configure(tx, child.id, {
        extensions: [conversationSearchExtension],
        tools: [searchConversationsTool],
      });
      return child.id;
    }, context);
    // A UI watching the parent sees the child in the call's details.
    await api.details({ conversationId: childId }, context);

    const child = await api.conversation(childId, context);
    if (child === undefined) throw new Error(`Search conversation ${childId} is missing`);
    const submission = await child.submit(
      {
        type: "input",
        content:
          `Answer this question using search_conversations: ${question}\n\n` +
          "Try a few relevant terms. If truncated is true, say the scan did not read the whole history. " +
          "Reply briefly, cite conversation IDs, and say so if nothing relevant was found.",
        // The task ID is stable across reruns, so a rerun gets back this submission.
        requestId: `search-history:${api.taskId}`,
      },
      context,
    );
    const settled = await submission.wait(context);
    if (settled.status !== "done" || settled.type !== "input") {
      throw new Error(`History search did not answer: ${settled.status}`);
    }
    const answer = await api.commit((tx) => tx.entry(AssistantEntry, settled.answer), context);
    const text = messageText(answer?.model?.[0] as AssistantMessage | undefined);
    return {
      output: [{ type: "text", text }],
      details: { conversationId: childId },
    };
  },
};
