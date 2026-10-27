import { AgentDoc, type Cursor, type Tx } from "@earendil-works/pi-durable";
import { FETCH_PAGE_TOOL_NAME } from "./web.ts";
import { WEB_SEARCH_TOOL_NAME } from "./web-search.ts";
import { forgetTool, rememberTool } from "./memory.ts";
import { SCHEDULE_TOOL_NAME } from "./tools.ts";
import { SEARCH_HISTORY_TOOL_NAME } from "./search.ts";

/**
 * The tools every top-level conversation is configured with. chat.ts builds its tool list from the same
 * objects, and a test keeps the two in step.
 */
export const DEFAULT_TOOL_NAMES: readonly string[] = [
  rememberTool.name,
  forgetTool.name,
  SCHEDULE_TOOL_NAME,
  SEARCH_HISTORY_TOOL_NAME,
  FETCH_PAGE_TOOL_NAME,
  WEB_SEARCH_TOOL_NAME,
];

const CONVERSATION_SCAN_PAGE_SIZE = 100;

/**
 * A conversation stores its tool list when it is created, and a stored list is an allow-list: a tool added to the
 * defaults later is never offered to that conversation. This appends the missing defaults to every top-level
 * conversation. Subagent conversations keep their own tools, and a conversation without a stored list already
 * enables every tool. Returns how many conversations changed.
 */
export async function addMissingDefaultTools(tx: Tx): Promise<number> {
  let changed = 0;
  let cursor: Cursor | undefined;
  do {
    const page = await tx.scanConversations({}, CONVERSATION_SCAN_PAGE_SIZE, cursor);
    for (const conversation of page.items) {
      if (conversation.owner !== undefined || conversation.parent !== undefined) continue;
      const state = await tx.doc(AgentDoc, conversation.id);
      const tools = state.tools;
      if (!Array.isArray(tools)) continue;
      const missing = DEFAULT_TOOL_NAMES.filter((name) => !tools.includes(name));
      if (missing.length === 0) continue;
      // The stored list holds names; pi-durable's addTools appends the same way.
      tools.push(...missing);
      changed += 1;
    }
    cursor = page.next;
  } while (cursor !== undefined);
  return changed;
}
