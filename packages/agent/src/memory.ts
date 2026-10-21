import { Type } from "@earendil-works/pi-ai";
import { defineDoc, section, type ToolRegistration } from "@earendil-works/pi-durable";

const MAX_FACTS = 100;

export const MotsMemory = defineDoc<{ facts: string[] }>({
  kind: "mots.memory",
  version: 1,
  scope: "session",
  initial: () => ({ facts: [] }),
});

type RememberArguments = { readonly fact: string };

type ForgetArguments = { readonly query: string };

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
    await api.commit(async (tx) => {
      const memory = await tx.doc(MotsMemory);
      const key = fact.toLowerCase();
      if (memory.facts.some((existing) => existing.toLowerCase() === key)) return;
      memory.facts.push(fact);
      if (memory.facts.length > MAX_FACTS) {
        memory.facts.splice(0, memory.facts.length - MAX_FACTS);
      }
      stored = true;
    }, context);
    return {
      output: [{ type: "text" as const, text: stored ? "Remembered." : "Already remembered." }],
      details: { stored },
    };
  },
};

export const forgetTool: ToolRegistration = {
  name: "forget",
  description:
    "Remove saved memories that match a phrase. Use it when the user asks you to forget something.",
  parameters: Type.Object({
    query: Type.String({
      minLength: 1,
      maxLength: 200,
      description: "Text to match against saved memories, case-insensitive",
    }),
  }),
  replay: "safe",
  execute: async (args: ForgetArguments, api, context) => {
    const needle = args.query.trim().toLowerCase();
    if (needle.length === 0) throw new Error("The query must contain text");
    let removed = 0;
    await api.commit(async (tx) => {
      const memory = await tx.doc(MotsMemory);
      const kept = memory.facts.filter((fact) => !fact.toLowerCase().includes(needle));
      removed = memory.facts.length - kept.length;
      memory.facts = kept;
    }, context);
    return {
      output: [
        {
          type: "text" as const,
          text: removed === 0 ? "No matching memory found." : `Forgot ${removed} memory.`,
        },
      ],
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
