import { describe, expect, test } from "bun:test";
import { MAX_PROMPT_CHARACTERS } from "@mots/protocol";
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

  test("edits a prompt by forking before it, then submits the new text in the branch", () => {
    const { client, socket } = connect();
    try {
      void client.editPrompt(1, 40, "Versione corretta");
      const fork = JSON.parse(socket.sent[0]!) as { readonly requestId: string };
      expect(JSON.parse(socket.sent[0]!)).toMatchObject({
        type: "conversation.fork",
        conversationId: 1,
        entryId: 40,
      });

      socket.message(
        JSON.stringify({
          type: "command.result",
          command: "conversation.fork",
          requestId: fork.requestId,
          ok: true,
          conversationId: 2,
        }),
      );

      expect(client.getSnapshot().activeConversationId).toBe(2);
      expect(socket.sent).toHaveLength(2);
      expect(JSON.parse(socket.sent[1]!)).toMatchObject({
        type: "prompt.submit",
        conversationId: 2,
        content: "Versione corretta",
      });
    } finally {
      client.dispose();
    }
  });

  test("reports the created branch before submitting the edited text", () => {
    const { client, socket } = connect();
    try {
      const branches: number[] = [];
      void client.editPrompt(1, 40, "Versione corretta", (branchId) => branches.push(branchId));
      const fork = JSON.parse(socket.sent[0]!) as { readonly requestId: string };
      socket.message(
        JSON.stringify({
          type: "command.result",
          command: "conversation.fork",
          requestId: fork.requestId,
          ok: true,
          conversationId: 7,
        }),
      );
      expect(branches).toEqual([7]);
      expect(JSON.parse(socket.sent[1]!)).toMatchObject({ type: "prompt.submit", conversationId: 7 });
    } finally {
      client.dispose();
    }
  });

  test("resolves an edit as failed when the branch callback throws", async () => {
    const { client, socket } = connect();
    try {
      const accepted = client.editPrompt(1, 40, "Ciao", () => {
        throw new Error("state unavailable");
      });
      const fork = JSON.parse(socket.sent[0]!) as { readonly requestId: string };
      socket.message(
        JSON.stringify({
          type: "command.result",
          command: "conversation.fork",
          requestId: fork.requestId,
          ok: true,
          conversationId: 7,
        }),
      );
      expect(await accepted).toBe(false);
      expect(socket.sent).toHaveLength(1);
    } finally {
      client.dispose();
    }
  });

  test("edits the first message by creating an empty conversation, then submitting in it", () => {
    const { client, socket } = connect();
    try {
      void client.editPrompt(1, undefined, "Ciao");
      expect(JSON.parse(socket.sent[0]!)).toMatchObject({ type: "conversation.create" });
      const create = JSON.parse(socket.sent[0]!) as { readonly requestId: string };
      socket.message(
        JSON.stringify({
          type: "command.result",
          command: "conversation.create",
          requestId: create.requestId,
          ok: true,
          conversationId: 3,
        }),
      );
      expect(JSON.parse(socket.sent[1]!)).toMatchObject({
        type: "prompt.submit",
        conversationId: 3,
        content: "Ciao",
      });
    } finally {
      client.dispose();
    }
  });

  test("does not branch when the edited text is empty", async () => {
    const { client, socket } = connect();
    try {
      expect(await client.editPrompt(1, 40, "   ")).toBe(false);
      expect(socket.sent).toHaveLength(0);
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
      expect(client.getSnapshot().error).toEqual({
        code: "invalid_frame",
        message: "Server sent an invalid protocol frame.",
      });
    } finally {
      client.dispose();
    }
  });

  test("preserves terminal server error codes", () => {
    const { client, socket } = connect();
    try {
      const error = { code: "invalid_command", message: "The command is invalid." };
      socket.message(JSON.stringify({ type: "error", error }));
      expect(client.getSnapshot().status).toBe("failed");
      expect(client.getSnapshot().error).toEqual(error);
    } finally {
      client.dispose();
    }
  });

  test("reports an empty prompt with a stable error code", async () => {
    const { client, socket } = connect();
    try {
      await expect(client.submitPrompt(1, " \n ")).resolves.toBe(false);
      expect(socket.sent).toHaveLength(0);
      expect(client.getSnapshot().error).toEqual({
        code: "empty_prompt",
        message: "A prompt must contain text",
      });
    } finally {
      client.dispose();
    }
  });

  test("reports an oversized prompt with a stable error code", async () => {
    const { client, socket } = connect();
    try {
      await expect(client.submitPrompt(1, "x".repeat(100_001))).resolves.toBe(false);
      expect(socket.sent).toHaveLength(0);
      expect(client.getSnapshot().error).toEqual({
        code: "prompt_too_long",
        message: `A prompt cannot exceed ${MAX_PROMPT_CHARACTERS.toLocaleString()} characters`,
      });
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
      expect(client.getSnapshot().snapshots[1]?.runError).toBe("no_response");
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
      expect(client.getSnapshot().error).toEqual({
        code: "unavailable",
        message: "Try again later",
      });
    } finally {
      client.dispose();
    }
  });
});

const snapshotFrame = JSON.stringify({
  type: "session.snapshot",
  session: { conversations: [{ id: 1 }] },
});

function ackFrame(command: string, requestId: string): string {
  return JSON.stringify({
    type: "command.result",
    command,
    requestId,
    ok: true,
    conversationId: 1,
  });
}

function requestIdOf(frame: string | undefined): string {
  const command = JSON.parse(frame ?? "null") as { readonly requestId: string };
  return command.requestId;
}

/** A client whose sockets are recorded in order, so a test can drop one and reconnect. */
function clientWithSockets() {
  const sockets: FakeSocket[] = [];
  const client = new MotsClient({
    baseUrl: "https://mots.example",
    sessionId: "session-1",
    username: "Luca",
    socketFactory: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket;
    },
  });
  return { client, sockets };
}

describe("MotsClient outbox while disconnected", () => {
  test("queues a prompt while disconnected and sends it once after reconnect", async () => {
    const { client, sockets } = clientWithSockets();
    try {
      client.connect();
      const first = sockets[0]!;
      first.open();
      first.message(snapshotFrame);
      first.close(1006, "network lost");

      const accepted = client.submitPrompt(1, "Ciao Mots");
      expect(first.sent).toHaveLength(0);

      client.connect();
      const second = sockets[1]!;
      second.open();
      expect(second.sent).toHaveLength(0);
      second.message(snapshotFrame);
      expect(second.sent).toHaveLength(1);
      expect(JSON.parse(second.sent[0]!)).toMatchObject({
        type: "prompt.submit",
        conversationId: 1,
        content: "Ciao Mots",
      });

      second.message(ackFrame("prompt.submit", requestIdOf(second.sent[0])));
      await expect(accepted).resolves.toBe(true);

      // An acknowledged command leaves the outbox, so the next reconnect does not resend it.
      second.close(1006, "network lost");
      client.connect();
      const third = sockets[2]!;
      third.open();
      third.message(snapshotFrame);
      expect(third.sent).toHaveLength(0);
    } finally {
      client.dispose();
    }
  });

  test("queues a model change while disconnected and sends it once after reconnect", async () => {
    const { client, sockets } = clientWithSockets();
    try {
      client.connect();
      sockets[0]!.open();
      sockets[0]!.message(snapshotFrame);
      sockets[0]!.close(1006, "network lost");

      const accepted = client.setModel(1, "openrouter", "reflection/beam-free");
      client.connect();
      const second = sockets[1]!;
      second.open();
      second.message(snapshotFrame);
      expect(second.sent).toHaveLength(1);
      expect(JSON.parse(second.sent[0]!)).toMatchObject({
        type: "conversation.setModel",
        conversationId: 1,
        provider: "openrouter",
        modelId: "reflection/beam-free",
      });

      second.message(ackFrame("conversation.setModel", requestIdOf(second.sent[0])));
      await expect(accepted).resolves.toBe(true);
    } finally {
      client.dispose();
    }
  });

  test("rejects a second prompt while the first is queued offline", async () => {
    const { client, sockets } = clientWithSockets();
    try {
      client.connect();
      sockets[0]!.open();
      sockets[0]!.message(snapshotFrame);
      sockets[0]!.close(1006, "network lost");

      const queued = client.submitPrompt(1, "Uno");
      expect(() => client.submitPrompt(1, "Due")).toThrow("already pending");

      client.dispose();
      await expect(queued).resolves.toBe(false);
    } finally {
      client.dispose();
    }
  });

  test("does not send a queued prompt twice when it was sent before the snapshot", async () => {
    const { client, sockets } = clientWithSockets();
    try {
      client.connect();
      const socket = sockets[0]!;
      socket.open();
      const accepted = client.submitPrompt(1, "Ciao");
      expect(socket.sent).toHaveLength(1);

      socket.message(snapshotFrame);
      expect(socket.sent).toHaveLength(1);

      socket.message(ackFrame("prompt.submit", requestIdOf(socket.sent[0])));
      await expect(accepted).resolves.toBe(true);
    } finally {
      client.dispose();
    }
  });

  test("replays a prompt sent before a drop but never acknowledged, once", async () => {
    const { client, sockets } = clientWithSockets();
    try {
      client.connect();
      const first = sockets[0]!;
      first.open();
      first.message(snapshotFrame);
      const accepted = client.submitPrompt(1, "Ciao");
      expect(first.sent).toHaveLength(1);
      first.close(1006, "network lost");

      client.connect();
      const second = sockets[1]!;
      second.open();
      second.message(snapshotFrame);
      expect(second.sent).toHaveLength(1);
      expect(requestIdOf(second.sent[0])).toBe(requestIdOf(first.sent[0]));

      second.message(ackFrame("prompt.submit", requestIdOf(second.sent[0])));
      await expect(accepted).resolves.toBe(true);
    } finally {
      client.dispose();
    }
  });

  test("does not queue typing presence while disconnected", () => {
    const { client, sockets } = clientWithSockets();
    try {
      client.connect();
      sockets[0]!.open();
      sockets[0]!.message(snapshotFrame);
      sockets[0]!.close(1006, "network lost");

      client.setTyping(1, true);
      client.connect();
      const second = sockets[1]!;
      second.open();
      second.message(snapshotFrame);
      expect(second.sent).toHaveLength(0);
    } finally {
      client.dispose();
    }
  });

  test("a terminal close resolves queued commands false and rejects new ones", async () => {
    const { client, sockets } = clientWithSockets();
    try {
      client.connect();
      sockets[0]!.open();
      sockets[0]!.message(snapshotFrame);
      sockets[0]!.close(1006, "network lost");

      const prompt = client.submitPrompt(1, "Ciao");
      const model = client.setModel(1, "openrouter", "reflection/beam-free");

      client.connect();
      sockets[1]!.close(1002, "  Invalid protocol frame  ");

      await expect(prompt).resolves.toBe(false);
      await expect(model).resolves.toBe(false);
      expect(client.getSnapshot().status).toBe("failed");
      expect(client.getSnapshot().error).toEqual({
        code: "connection_failed",
        message: "Invalid protocol frame",
      });
      await expect(client.submitPrompt(1, "Tardi")).resolves.toBe(false);
      expect(sockets[1]!.sent).toHaveLength(0);
    } finally {
      client.dispose();
    }
  });
});
