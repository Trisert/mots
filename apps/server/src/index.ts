import {
  createMotsModels,
  modelCatalog,
  modelPolicy,
  type MotsEnvironment,
  resolveMotsProvider,
} from "@mots/agent";
import { MemoryRateLimiter } from "./rate-limit.ts";
import { handleRequest, type RouterEnv } from "./router.ts";

export { Session } from "./session.ts";

const limiter = new MemoryRateLimiter();

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const gate: RouterEnv = env;
    return handleRequest(request, {
      env: gate,
      limiter,
      now: Date.now,
      getSession: (sessionId) => env.SESSIONS.getByName(sessionId),
      listModels: async () => {
        // The same registry and policy the Session object builds, so every listed model is one
        // `conversation.setModel` accepts. Live catalogs are cached per isolate.
        const values = env as unknown as MotsEnvironment;
        const provider = resolveMotsProvider(values.MOTS_PROVIDER);
        const models = await createMotsModels(values, provider);
        return modelCatalog(models, modelPolicy(values, provider));
      },
    });
  },
} satisfies ExportedHandler<Env>;
