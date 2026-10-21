export { Session } from "./session.ts";

const json = (body: unknown, status: number, headers?: HeadersInit): Response =>
  Response.json(body, { status, headers });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
} satisfies Record<string, string>;

const withCors = (response: Response): Response => {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(cors)) headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const sessionSocketRoute = /^\/api\/sessions\/([A-Za-z0-9_-]{1,128})\/?$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }));
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      if (request.method !== "GET") {
        return withCors(json({ error: "Method not allowed" }, 405, { Allow: "GET" }));
      }
      return withCors(json({ ok: true, service: "mots" }, 200));
    }

    if (url.pathname === "/api/sessions" || url.pathname === "/api/sessions/") {
      if (request.method !== "POST") {
        return withCors(json({ error: "Method not allowed" }, 405, { Allow: "POST" }));
      }
      const sessionId = crypto.randomUUID();
      return withCors(
        json(
          {
            sessionId,
            url: `/sessions/${sessionId}`,
            socketPath: `/api/sessions/${sessionId}`,
          },
          201,
        ),
      );
    }

    const sessionMatch = sessionSocketRoute.exec(url.pathname);
    if (sessionMatch !== null) {
      if (request.method !== "GET") {
        return withCors(json({ error: "Method not allowed" }, 405, { Allow: "GET" }));
      }
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return withCors(
          json({ error: "WebSocket upgrade required" }, 426, { Upgrade: "websocket" }),
        );
      }
      return env.SESSIONS.getByName(sessionMatch[1]!).fetch(request);
    }

    return withCors(json({ error: "Not found" }, 404));
  },
} satisfies ExportedHandler<Env>;
