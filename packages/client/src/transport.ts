import {
  MAX_PROMPT_CHARACTERS,
  parseServerEventEnvelope,
  ROOT_CONVERSATION_ID,
  type ClientCommand,
  type ServerEvent,
  type SessionLocale,
} from "@mots/protocol";
import { CommandOutbox, type RetriableCommand } from "./command-outbox.ts";
import { CLIENT_ERROR, type SessionError } from "./errors.ts";
import {
  initialSessionState,
  sessionReducer,
  type SessionState,
} from "./session-state.ts";

type MessageEventLike = { readonly data: unknown };
type CloseEventLike = { readonly code: number; readonly reason?: string };

export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(
    type: "open" | "error",
    listener: () => void,
  ): void;
  addEventListener(type: "message", listener: (event: MessageEventLike) => void): void;
  addEventListener(type: "close", listener: (event: CloseEventLike) => void): void;
}

export type SocketFactory = (url: string) => SocketLike;

export interface MotsClientOptions {
  readonly baseUrl: string;
  readonly sessionId: string;
  readonly username: string;
  readonly initialConversationId?: number;
  /** IANA timezone of the device. Sent after every snapshot so reminders use local time. */
  readonly timezone?: string;
  /** App language. Sent after every snapshot so the agent replies in it. */
  readonly locale?: SessionLocale;
  readonly socketFactory?: SocketFactory;
}

type Listener = (state: SessionState) => void;

const TERMINAL_CLOSE_CODES = new Set([1002, 1009]);
const MAX_RECONNECT_DELAY_MS = 10_000;
const BASE_RECONNECT_DELAY_MS = 400;

let requestCounter = 0;

function newRequestId(): string {
  const uuid = globalThis.crypto?.randomUUID;
  if (typeof uuid === "function") return uuid.call(globalThis.crypto);
  requestCounter += 1;
  return `${Date.now().toString(36)}-${requestCounter.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function socketUrl(baseUrl: string, sessionId: string, username: string): string {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/api/sessions/${encodeURIComponent(sessionId)}`;
  url.search = `?username=${encodeURIComponent(username)}`;
  url.hash = "";
  return url.toString();
}

const defaultSocketFactory: SocketFactory = (url) =>
  new WebSocket(url) as unknown as SocketLike;

export class MotsClient {
  readonly #options: Required<Pick<MotsClientOptions, "baseUrl" | "sessionId" | "username">> &
    MotsClientOptions;
  readonly #socketFactory: SocketFactory;
  readonly #listeners = new Set<Listener>();
  readonly #outbox = new CommandOutbox();
  #state: SessionState = initialSessionState;
  #socket: SocketLike | undefined;
  #desiredConversationId: number | undefined;
  #conversationOpened = false;
  #closed = false;
  #terminal = false;
  #reconnectAttempt = 0;
  #reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  #locale: SessionLocale | undefined;

  constructor(options: MotsClientOptions) {
    this.#options = options;
    this.#locale = options.locale;
    this.#socketFactory = options.socketFactory ?? defaultSocketFactory;
    this.#desiredConversationId = options.initialConversationId;
  }

  readonly getSnapshot = (): SessionState => this.#state;

  readonly subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  connect(): void {
    if (this.#closed || this.#terminal) return;
    const current = this.#socket;
    if (current !== undefined && (current.readyState === 0 || current.readyState === 1)) return;

    const socket = this.#socketFactory(
      socketUrl(this.#options.baseUrl, this.#options.sessionId, this.#options.username),
    );
    this.#socket = socket;

    socket.addEventListener("open", () => {
      if (this.#socket !== socket) return;
      this.#reconnectAttempt = 0;
      this.#conversationOpened = false;
      this.#outbox.startConnection();
      this.#dispatch({ type: "connection", status: "connected" });
      this.#dispatch({ type: "clear-error" });
    });

    socket.addEventListener("message", (event) => {
      if (this.#socket !== socket) return;
      this.#handleMessage(socket, event.data);
    });

    socket.addEventListener("error", () => {
      if (this.#socket !== socket || this.#terminal) return;
      this.#dispatch({ type: "connection", status: "connecting" });
    });

    socket.addEventListener("close", (event) => {
      if (this.#socket !== socket) return;
      this.#socket = undefined;
      if (this.#closed) return;
      if (this.#terminal || TERMINAL_CLOSE_CODES.has(event.code)) {
        const wasTerminal = this.#terminal;
        this.#terminal = true;
        this.#outbox.clear();
        this.#dispatch({ type: "connection", status: "failed" });
        if (!wasTerminal) {
          this.#dispatch({
            type: "error",
            error: {
              code: CLIENT_ERROR.connectionFailed,
              message: event.reason?.trim() || "The session connection failed.",
            },
          });
        }
        return;
      }
      this.#dispatch({ type: "connection", status: "connecting" });
      this.#scheduleReconnect();
    });
  }

  dispose(): void {
    this.#closed = true;
    this.#outbox.clear();
    if (this.#reconnectTimer !== undefined) {
      clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = undefined;
    }
    const socket = this.#socket;
    this.#socket = undefined;
    socket?.close(1000, "Session view closed");
  }

  openConversation(conversationId: number): void {
    this.#desiredConversationId = conversationId;
    this.#dispatch({ type: "select", conversationId });
    this.#send({
      type: "conversation.open",
      requestId: newRequestId(),
      conversationId,
    });
  }

  createConversation(): void {
    this.#sendRetriable({ type: "conversation.create", requestId: newRequestId() });
  }

  forkConversation(conversationId: number, entryId: number): void {
    this.#sendRetriable({
      type: "conversation.fork",
      requestId: newRequestId(),
      conversationId,
      entryId,
    });
  }

  setTyping(conversationId: number, typing: boolean): void {
    this.#send({ type: "presence.typing", conversationId, typing }, false);
  }

  submitPrompt(conversationId: number, content: string): Promise<boolean> {
    if (content.trim().length === 0) {
      this.#dispatch({
        type: "error",
        error: {
          code: CLIENT_ERROR.emptyPrompt,
          message: "A prompt must contain text",
        },
      });
      return Promise.resolve(false);
    }
    if (content.length > MAX_PROMPT_CHARACTERS) {
      this.#dispatch({
        type: "error",
        error: {
          code: CLIENT_ERROR.promptTooLong,
          message: `A prompt cannot exceed ${MAX_PROMPT_CHARACTERS.toLocaleString()} characters`,
        },
      });
      return Promise.resolve(false);
    }
    if (this.#outbox.has("prompt.submit")) {
      throw new Error("A prompt submission is already pending");
    }
    const command = {
      type: "prompt.submit",
      requestId: newRequestId(),
      conversationId,
      content,
    } satisfies Extract<ClientCommand, { readonly type: "prompt.submit" }>;
    return new Promise((resolve) => {
      this.#outbox.enqueue(command, resolve);
      this.#transmit(command);
    });
  }

  setModel(conversationId: number, provider: string, modelId: string): Promise<boolean> {
    const command = {
      type: "conversation.setModel",
      requestId: newRequestId(),
      conversationId,
      provider,
      modelId,
    } satisfies Extract<ClientCommand, { readonly type: "conversation.setModel" }>;
    return new Promise((resolve) => {
      this.#outbox.enqueue(command, resolve);
      this.#transmit(command);
    });
  }

  /** Change the app language. Sent now when connected, otherwise after the next snapshot. */
  setLocale(locale: SessionLocale): void {
    this.#locale = locale;
    this.#sendLocale();
  }

  clearError(): void {
    if (this.#state.error === undefined) return;
    this.#dispatch({ type: "clear-error" });
  }

  #handleMessage(socket: SocketLike, data: unknown): void {
    if (typeof data !== "string") {
      this.#fail(socket, {
        code: CLIENT_ERROR.invalidFrame,
        message: "Server sent a binary protocol frame.",
      });
      return;
    }
    let event: ServerEvent;
    try {
      event = parseServerEventEnvelope(data);
    } catch {
      this.#fail(socket, {
        code: CLIENT_ERROR.invalidFrame,
        message: "Server sent an invalid protocol frame.",
      });
      return;
    }

    if (
      event.type === "error" &&
      (event.error.code === "invalid_message" ||
        event.error.code === "invalid_command" ||
        event.error.code === "frame_too_large")
    ) {
      this.#terminal = true;
      this.#fail(socket, event.error);
      return;
    }

    this.#dispatch({ type: "event", event });

    if (event.type === "session.snapshot" && !this.#conversationOpened) {
      this.#conversationOpened = true;
      const conversations = event.session.conversations;
      const desired = this.#desiredConversationId;
      const chosen =
        (desired !== undefined && conversations.some(({ id }) => id === desired)
          ? desired
          : undefined) ??
        conversations.find(({ id }) => id === ROOT_CONVERSATION_ID)?.id ??
        conversations[0]?.id;
      if (chosen !== undefined) {
        this.#desiredConversationId = chosen;
        if (chosen !== ROOT_CONVERSATION_ID) {
          this.#dispatch({ type: "select", conversationId: chosen });
          this.#send({
            type: "conversation.open",
            requestId: newRequestId(),
            conversationId: chosen,
          });
        }
      }
      if (this.#options.timezone !== undefined) {
        this.#send(
          {
            type: "session.setTimezone",
            requestId: newRequestId(),
            timezone: this.#options.timezone,
          },
          false,
        );
      }
      this.#sendLocale();
      this.#outbox.replay((command) => this.#transmit(command));
    }

    if (event.type === "command.result") {
      const acknowledged = this.#outbox.acknowledge(event);
      if (!event.ok) {
        this.#dispatch({
          type: "error",
          error: event.error,
        });
      } else if (
        acknowledged !== undefined &&
        event.conversationId !== undefined &&
        (acknowledged.type === "conversation.create" ||
          acknowledged.type === "conversation.fork")
      ) {
        this.#desiredConversationId = event.conversationId;
        this.#dispatch({ type: "select", conversationId: event.conversationId });
      }
    }
  }

  #fail(socket: SocketLike, error: SessionError): void {
    this.#terminal = true;
    this.#outbox.clear();
    this.#dispatch({ type: "connection", status: "failed" });
    this.#dispatch({ type: "error", error });
    try {
      socket.close(1002, "Invalid protocol frame");
    } catch {
      return;
    }
  }

  #scheduleReconnect(): void {
    if (this.#reconnectTimer !== undefined || this.#closed) return;
    const delay = Math.min(
      BASE_RECONNECT_DELAY_MS * 2 ** this.#reconnectAttempt,
      MAX_RECONNECT_DELAY_MS,
    );
    this.#reconnectAttempt += 1;
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = undefined;
      this.connect();
    }, delay + Math.floor(Math.random() * 250));
  }

  #sendLocale(): void {
    if (this.#locale === undefined) return;
    this.#send(
      { type: "session.setLocale", requestId: newRequestId(), locale: this.#locale },
      false,
    );
  }

  #send(command: ClientCommand, reportFailure = true): boolean {
    const socket = this.#socket;
    if (socket === undefined || socket.readyState !== 1) {
      if (reportFailure) {
        this.#dispatch({
          type: "error",
          error: {
            code: CLIENT_ERROR.notConnected,
            message: "The session is not connected",
          },
        });
      }
      return false;
    }
    try {
      socket.send(JSON.stringify(command));
      return true;
    } catch {
      if (reportFailure) {
        this.#dispatch({
          type: "error",
          error: {
            code: CLIENT_ERROR.connectionFailed,
            message: "The session connection failed",
          },
        });
      }
      return false;
    }
  }

  #sendRetriable(command: RetriableCommand): void {
    this.#outbox.enqueue(command);
    this.#transmit(command);
  }

  /**
   * Sends an outbox command, or leaves it queued for the next session.snapshot when the socket
   * is not open. Commands that stay queued resolve when the server acks them, or false when the
   * outbox is cleared on a terminal close.
   */
  #transmit(command: RetriableCommand): void {
    if (this.#terminal || this.#closed) {
      // Nothing replays the outbox after a terminal close, so fail now rather than queue forever.
      this.#outbox.cancel(command.requestId);
      this.#dispatch({
        type: "error",
        error: {
          code: CLIENT_ERROR.notConnected,
          message: "The session is not connected",
        },
      });
      return;
    }
    const socket = this.#socket;
    if (socket === undefined || socket.readyState !== 1) return;
    try {
      socket.send(JSON.stringify(command));
    } catch {
      // The socket reported open but send threw, so the frame may or may not have left. Replaying
      // it later could duplicate it, so fail it now, as before.
      this.#outbox.cancel(command.requestId);
      this.#dispatch({
        type: "error",
        error: {
          code: CLIENT_ERROR.connectionFailed,
          message: "The session connection failed",
        },
      });
      return;
    }
    this.#outbox.markSent(command.requestId);
  }

  #dispatch(action: Parameters<typeof sessionReducer>[1]): void {
    const next = sessionReducer(this.#state, action);
    if (next === this.#state) return;
    this.#state = next;
    for (const listener of this.#listeners) listener(next);
  }
}
