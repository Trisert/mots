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

const locales = (socket: SnapshotSocket) =>
  socket.sent.map((text) => JSON.parse(text) as { type: string; locale?: string }).filter((command) => command.type === "session.setLocale");

describe("MotsClient locale", () => {
  test("reports the app language after the snapshot", () => {
    const socket = new SnapshotSocket();
    const client = new MotsClient({
      baseUrl: "https://mots.example",
      sessionId: "session-1",
      username: "Luca",
      locale: "it",
      socketFactory: () => socket,
    });
    try {
      client.connect();
      socket.connect();
      expect(locales(socket)).toMatchObject([{ type: "session.setLocale", locale: "it" }]);
    } finally {
      client.dispose();
    }
  });

  test("sends a changed language on the open socket and sends nothing before connecting", () => {
    const socket = new SnapshotSocket();
    const client = new MotsClient({
      baseUrl: "https://mots.example",
      sessionId: "session-1",
      username: "Luca",
      locale: "en",
      socketFactory: () => socket,
    });
    try {
      client.setLocale("it");
      client.connect();
      socket.connect();
      client.setLocale("en");
      expect(locales(socket).map((command) => command.locale)).toEqual(["it", "en"]);
    } finally {
      client.dispose();
    }
  });
});

describe("MotsClient push token", () => {
  const registrations = (socket: SnapshotSocket) =>
    socket.sent
      .map((text) => JSON.parse(text) as { type: string; token?: string })
      .filter((command) => command.type === "pushToken.register");

  test("registers the push token after the snapshot and again on a later change", () => {
    const socket = new SnapshotSocket();
    const client = new MotsClient({
      baseUrl: "https://mots.example",
      sessionId: "session-1",
      username: "Luca",
      socketFactory: () => socket,
    });
    try {
      client.setPushToken("ExponentPushToken[first]");
      client.connect();
      socket.connect();
      client.setPushToken("ExponentPushToken[second]");
      expect(registrations(socket).map((command) => command.token)).toEqual([
        "ExponentPushToken[first]",
        "ExponentPushToken[second]",
      ]);
    } finally {
      client.dispose();
    }
  });

  test("sends nothing before a token is known", () => {
    const socket = new SnapshotSocket();
    const client = new MotsClient({
      baseUrl: "https://mots.example",
      sessionId: "session-1",
      username: "Luca",
      socketFactory: () => socket,
    });
    try {
      client.connect();
      socket.connect();
      expect(registrations(socket)).toEqual([]);
    } finally {
      client.dispose();
    }
  });
});
