import { describe, expect, test } from "bun:test";
import { MotsClient, type SocketLike } from "../src/index.ts";

type MessageListener = (event: { readonly data: unknown }) => void;

/** Just enough socket for the snapshot path: open, receive one message, record sends. */
class SnapshotSocket implements SocketLike {
  readyState = 0;
  readonly sent: string[] = [];
  readonly #open = new Set<() => void>();
  readonly #message = new Set<MessageListener>();

  addEventListener(type: "open" | "error" | "message" | "close", listener: (...args: never[]) => void): void {
    if (type === "open") this.#open.add(listener as () => void);
    if (type === "message") this.#message.add(listener as MessageListener);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
  }

  connect(): void {
    this.readyState = 1;
    for (const listener of this.#open) listener();
    const snapshot = JSON.stringify({ type: "session.snapshot", session: { conversations: [{ id: 1 }] } });
    for (const listener of this.#message) listener({ data: snapshot });
  }
}

const connected = (timezone: string | undefined) => {
  const socket = new SnapshotSocket();
  const client = new MotsClient({
    baseUrl: "https://mots.example",
    sessionId: "session-1",
    username: "Luca",
    ...(timezone === undefined ? {} : { timezone }),
    socketFactory: () => socket,
  });
  client.connect();
  socket.connect();
  return { client, socket };
};

describe("MotsClient timezone", () => {
  test("reports the device timezone after the snapshot", () => {
    const { client, socket } = connected("Europe/Rome");
    try {
      expect(socket.sent).toHaveLength(1);
      expect(JSON.parse(socket.sent[0]!)).toMatchObject({
        type: "session.setTimezone",
        timezone: "Europe/Rome",
      });
    } finally {
      client.dispose();
    }
  });

  test("sends nothing when the device has no timezone", () => {
    const { client, socket } = connected(undefined);
    try {
      expect(socket.sent).toHaveLength(0);
    } finally {
      client.dispose();
    }
  });
});
