import { describe, expect, test } from "bun:test";
import { MotsClient, type SocketLike } from "../src/index.ts";

type MessageListener = (event: { readonly data: unknown }) => void;
type CloseListener = (event: {
  readonly code: number;
  readonly reason?: string;
}) => void;

class FakeSocket implements SocketLike {
  readyState = 0;
  readonly url: string;
  readonly sent: string[] = [];
  private readonly openListeners = new Set<() => void>();
  private readonly errorListeners = new Set<() => void>();
  private readonly messageListeners = new Set<MessageListener>();
  private readonly closeListeners = new Set<CloseListener>();

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(type: "open" | "error", listener: () => void): void;
  addEventListener(type: "message", listener: MessageListener): void;
  addEventListener(type: "close", listener: CloseListener): void;
  addEventListener(
    type: "open" | "error" | "message" | "close",
    listener: (...args: never[]) => void,
  ): void {
    if (type === "message") {
      this.messageListeners.add(listener as MessageListener);
      return;
    }
    if (type === "close") {
      this.closeListeners.add(listener as CloseListener);
      return;
    }
    if (type === "error") {
      this.errorListeners.add(listener as () => void);
      return;
    }
    this.openListeners.add(listener as () => void);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(code = 1000, reason?: string): void {
    this.readyState = 3;
    for (const listener of this.closeListeners) listener({ code, reason });
  }

  open(): void {
    this.readyState = 1;
    for (const listener of this.openListeners) listener();
  }

  message(data: unknown): void {
    for (const listener of this.messageListeners) listener({ data });
  }
}

function connect(username = "Luca") {
  let socket: FakeSocket | undefined;
  const client = new MotsClient({
    baseUrl: "https://mots.example",
    sessionId: "session-1",
    username,
    socketFactory: (url) => {
      socket = new FakeSocket(url);
      return socket;
    },
  });
  client.connect();
  if (socket === undefined) throw new Error("socket was not created");
  const initial = socket;
  initial.open();
  initial.message(
    JSON.stringify({
      type: "session.snapshot",
      session: { conversations: [{ id: 1 }] },
    }),
  );
  return { client, socket: initial };
}

describe("MotsClient", () => {
  test("connects to the session socket and selects the root conversation", () => {
    const { client, socket } = connect();
    try {
      expect(socket.url).toBe(
        "wss://mots.example/api/sessions/session-1?username=Luca",
      );
      expect(client.getSnapshot().status).toBe("connected");
      expect(client.getSnapshot().activeConversationId).toBe(1);
    } finally {
      client.dispose();
    }
  });

  test("submits a prompt and resolves when the server acknowledges it", async () => {
    const { client, socket } = connect();
    try {
      const accepted = client.submitPrompt(1, "Ciao Mots");
      expect(socket.sent).toHaveLength(1);
      const command = JSON.parse(socket.sent[0]!) as {
        readonly type: string;
        readonly requestId: string;
        readonly conversationId: number;
        readonly content: string;
      };
      expect(command).toMatchObject({
        type: "prompt.submit",
        conversationId: 1,
        content: "Ciao Mots",
      });

      socket.message(
        JSON.stringify({
          type: "command.result",
          command: "prompt.submit",
          requestId: command.requestId,
          ok: true,
          conversationId: 1,
          submissionId: 9,
        }),
      );

      await expect(accepted).resolves.toBe(true);
    } finally {
      client.dispose();
    }
  });

  test("selects a newly created conversation", () => {
    const { client, socket } = connect();
    try {
      client.createConversation();
      const command = JSON.parse(socket.sent[0]!) as {
        readonly type: string;
        readonly requestId: string;
      };
      expect(command.type).toBe("conversation.create");

      socket.message(
        JSON.stringify({
          type: "command.result",
          command: "conversation.create",
          requestId: command.requestId,
          ok: true,
          conversationId: 2,
        }),
      );

      expect(client.getSnapshot().activeConversationId).toBe(2);
    } finally {
      client.dispose();
    }
  });

  test("fails terminally on an invalid protocol frame", () => {
    const { client, socket } = connect();
    try {
      socket.message("{not json");
      expect(client.getSnapshot().status).toBe("failed");
      expect(client.getSnapshot().error).toContain("Invalid protocol frame");
    } finally {
      client.dispose();
    }
  });

  test("flags a run that ends without an assistant message", () => {
    const { client, socket } = connect();
    try {
      socket.message(
        JSON.stringify({
          type: "conversation.events",
          conversationId: 1,
          events: [
            { type: "run_start", inputs: [1] },
            { type: "run_end", inputs: [1] },
          ],
        }),
      );
      expect(client.getSnapshot().snapshots[1]?.runError).toContain(
        "Il modello non ha risposto",
      );
    } finally {
      client.dispose();
    }
  });

  test("does not flag a run that produced an assistant message", () => {
    const { client, socket } = connect();
    try {
      socket.message(
        JSON.stringify({
          type: "conversation.events",
          conversationId: 1,
          events: [
            { type: "run_start", inputs: [1] },
            {
              type: "message_start",
              message: {
                role: "assistant",
                content: [{ type: "text", text: "Ciao" }],
              },
            },
            {
              type: "message_end",
              entry: {
                id: 2,
                conversationId: 1,
                kind: "pi.assistant",
                model: [
                  {
                    role: "assistant",
                    content: [{ type: "text", text: "Ciao" }],
                  },
                ],
              },
            },
            { type: "run_end", inputs: [1] },
          ],
        }),
      );
      expect(client.getSnapshot().snapshots[1]?.runError).toBeUndefined();
    } finally {
      client.dispose();
    }
  });

  test("surfaces command failures as state errors", async () => {
    const { client, socket } = connect();
    try {
      const accepted = client.submitPrompt(1, "Ciao");
      const command = JSON.parse(socket.sent[0]!) as {
        readonly requestId: string;
      };
      socket.message(
        JSON.stringify({
          type: "command.result",
          command: "prompt.submit",
          requestId: command.requestId,
          ok: false,
          error: { code: "unavailable", message: "Try again later" },
        }),
      );
      await expect(accepted).resolves.toBe(false);
      expect(client.getSnapshot().error).toBe("Try again later");
    } finally {
      client.dispose();
    }
  });
});
