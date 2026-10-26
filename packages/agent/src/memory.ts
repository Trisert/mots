import { Type } from "@earendil-works/pi-ai";
import { defineDoc, section, type ToolRegistration } from "@earendil-works/pi-durable";

const MAX_FACTS = 100;
// A substring match is removed automatically only when the query is at least this long.
const MIN_PARTIAL_QUERY = 3;
const MAX_CANDIDATES = 5;

export const MotsMemory = defineDoc<{ facts: string[] }>({
  kind: "mots.memory",
  version: 1,
  scope: "session",
  initial: () => ({ facts: [] }),
});

type RememberArguments = { readonly fact: string };

type ForgetArguments = { readonly query: string };

/** Trims, collapses runs of whitespace, and lowercases, so matching ignores case and spacing. */
export function normalizeFact(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Splits fact indexes into exact matches (normalized equal to the query) and partial matches
 * (normalized contains the query but is not equal). An empty query matches nothing.
 */
export function matchFacts(
  facts: readonly string[],
  query: string,
): { exact: number[]; partial: number[] } {
  const needle = normalizeFact(query);
  const exact: number[] = [];
  const partial: number[] = [];
  if (needle.length === 0) return { exact, partial };
  facts.forEach((fact, index) => {
    const normalized = normalizeFact(fact);
    if (normalized === needle) exact.push(index);
    else if (normalized.includes(needle)) partial.push(index);
  });
  return { exact, partial };
}

/**
 * Decides what `forget` removes. Exact matches always win, and they are the only thing removed when present.
 * Without an exact match, a single partial match is removed only when the query is specific enough.
 * Otherwise nothing is removed, and the partial matches are returned as candidates for the model to choose from.
 */
export function planForget(
  facts: readonly string[],
  query: string,
): { remove: number[]; candidates: number[] } {
  const { exact, partial } = matchFacts(facts, query);
  if (exact.length > 0) return { remove: exact, candidates: [] };
  if (partial.length === 1 && normalizeFact(query).length >= MIN_PARTIAL_QUERY) {
    return { remove: partial, candidates: [] };
  }
  return { remove: [], candidates: partial };
}

/**
 * Appends a fact and drops the oldest facts when the list would exceed `limit`.
 * Returns the new list and the dropped facts, oldest first.
 */
export function addFact(
  facts: readonly string[],
  fact: string,
  limit: number = MAX_FACTS,
): { facts: string[]; dropped: string[] } {
  const next = [...facts, fact];
  const overflow = Math.max(0, next.length - limit);
  return { facts: next.slice(overflow), dropped: next.slice(0, overflow) };
}

function forgetMessage(removed: number, candidates: readonly string[]): string {
  if (removed > 0) return `Forgot ${removed} ${removed === 1 ? "memory" : "memories"}.`;
  if (candidates.length === 0) return "No matching memory found.";
  const shown = candidates.slice(0, MAX_CANDIDATES);
  const header =
    candidates.length === 1
      ? "Nothing was removed. No memory matches exactly, and one memory contains that text:"
      : `Nothing was removed. No memory matches exactly, and ${candidates.length} memories contain that text:`;
  const list = shown.map((fact, index) => `${index + 1}. ${fact}`).join("\n");
  const more =
    candidates.length > MAX_CANDIDATES ? `\n(Showing ${MAX_CANDIDATES} of ${candidates.length}.)` : "";
  return `${header}\n${list}${more}\nCall forget again with the full exact text of the fact to remove.`;
}

export const rememberTool: ToolRegistration = {
  name: "remember",
  description:
    "Save a durable fact or preference about the user so it is available in every future conversation. Use it when the user shares something worth carrying forward.",
  parameters: Type.Object({
    fact: Type.String({
      minLength: 1,
      maxLength: 500,
      description: "A short, self-contained fact written in the third person",
    }),
  }),
  replay: "safe",
  execute: async (args: RememberArguments, api, context) => {
    const fact = args.fact.trim();
    if (fact.length === 0) throw new Error("The fact must contain text");
    let stored = false;
    let dropped: string[] = [];
    await api.commit(async (tx) => {
      const memory = await tx.doc(MotsMemory);
      const key = fact.toLowerCase();
      if (memory.facts.some((existing) => existing.toLowerCase() === key)) return;
      const next = addFact(memory.facts, fact, MAX_FACTS);
      memory.facts = next.facts;
      dropped = next.dropped;
      stored = true;
    }, context);
    const base = stored ? "Remembered." : "Already remembered.";
    const note =
      dropped.length === 0
        ? ""
        : ` Memory is full, so the oldest ${dropped.length} ${dropped.length === 1 ? "fact was" : "facts were"} dropped: ${dropped.map((item) => `"${item}"`).join(", ")}`;
    return {
      output: [{ type: "text" as const, text: `${base}${note}` }],
      details: { stored, dropped },
    };
  },
};

export const forgetTool: ToolRegistration = {
  name: "forget",
  description:
    "Remove saved memories. Pass the full text of the fact to remove, as shown in memory. Use it when the user asks you to forget something.",
  parameters: Type.Object({
    query: Type.String({
      minLength: 1,
      maxLength: 200,
      description:
        "The full text of the fact to remove, as shown in memory. Matching ignores case and extra spaces.",
    }),
  }),
  // Safe to replay: an exact match is removed once and is gone on the next run, and a single partial match
  // is gone the same way. A second run finds nothing new to remove.
  replay: "safe",
  execute: async (args: ForgetArguments, api, context) => {
    if (normalizeFact(args.query).length === 0) throw new Error("The query must contain text");
    let removed = 0;
    let candidates: string[] = [];
    await api.commit(async (tx) => {
      const memory = await tx.doc(MotsMemory);
      const plan = planForget(memory.facts, args.query);
      if (plan.remove.length > 0) {
        const drop = new Set(plan.remove);
        memory.facts = memory.facts.filter((_, index) => !drop.has(index));
        removed = plan.remove.length;
      }
      candidates = plan.candidates.map((index) => memory.facts[index] ?? "");
    }, context);
    return {
      output: [{ type: "text" as const, text: forgetMessage(removed, candidates) }],
      details: { removed },
    };
  },
};

export const memorySection = section("memory", async (input, context) => {
  const memory = await input.read.snapshot(MotsMemory, context);
  if (memory === undefined || memory.facts.length === 0) return undefined;
  return [
    "Durable notes about the user. Use them naturally when relevant; do not recite the list.",
    ...memory.facts.map((fact) => `- ${fact}`),
  ].join("\n");
});
