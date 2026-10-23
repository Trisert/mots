#!/usr/bin/env bun
/**
 * Lists the models the Vercel AI Gateway currently offers for free, marking the ones that support
 * tool calling, which Mots requires for memory, reminders and history search.
 *
 * Usage: bun run scripts/gateway-models.ts
 */
import { gatewayModels, isFreeGatewayModel, type GatewayModel } from "../packages/agent/src/provider.ts";

const response = await fetch("https://ai-gateway.vercel.sh/v1/models", {
  headers: { accept: "application/json" },
});
if (!response.ok) {
  console.error(`Vercel AI Gateway catalog request failed: ${response.status}`);
  process.exit(1);
}
const body = (await response.json()) as { readonly data?: readonly GatewayModel[] };
const catalog = body.data ?? [];
const free = catalog.filter(isFreeGatewayModel);
const toolCapable = new Set(
  (await gatewayModels()).map((model) => model.id),
);

console.log(`Free models on the Vercel AI Gateway: ${free.length}\n`);
for (const model of free) {
  const tools = toolCapable.has(model.id) ? "tools" : "no tools (not usable by Mots)";
  console.log(`  ${model.id.padEnd(42)} ${tools}`);
}

console.log(`\nTotal models in the gateway catalog: ${catalog.length}`);
console.log("Models usable by Mots (tool calling):", toolCapable.size);
console.log(
  "\nSet one with MOTS_PROVIDER=vercel-ai-gateway and MOTS_MODEL=<model id>.",
);
