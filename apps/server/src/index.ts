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
    });
  },
} satisfies ExportedHandler<Env>;
