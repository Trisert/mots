import type { ClientCommand, CommandResult } from "@mots/protocol";

export type RetriableCommand = Extract<
  ClientCommand,
  {
    readonly type:
      | "conversation.create"
      | "conversation.fork"
      | "prompt.submit"
      | "conversation.setModel";
  }
>;

type Completion = (accepted: boolean) => void;

type PendingCommand = {
  readonly command: RetriableCommand;
  readonly complete?: Completion;
  /** Whether the current socket has carried this command. Reset by `startConnection`. */
  sent: boolean;
};

/** Retains mutating commands until the server acknowledges their durable request IDs. */
export class CommandOutbox {
  readonly #pending = new Map<string, PendingCommand>();

  enqueue(command: RetriableCommand, complete?: Completion): void {
    if (this.#pending.has(command.requestId)) {
      throw new Error(`Command ${command.requestId} is already pending`);
    }
    this.#pending.set(command.requestId, {
      command,
      sent: false,
      ...(complete === undefined ? {} : { complete }),
    });
  }

  has(type: RetriableCommand["type"]): boolean {
    return [...this.#pending.values()].some(({ command }) => command.type === type);
  }

  /** A new socket has carried nothing yet, so every pending command is due for replay. */
  startConnection(): void {
    for (const pending of this.#pending.values()) pending.sent = false;
  }

  /** Records a successful direct send, so replay on the same socket does not send it again. */
  markSent(requestId: string): void {
    const pending = this.#pending.get(requestId);
    if (pending !== undefined) pending.sent = true;
  }

  /** Sends the commands the current socket has not carried, in enqueue order. */
  replay(send: (command: RetriableCommand) => void): void {
    for (const pending of this.#pending.values()) {
      if (!pending.sent) send(pending.command);
    }
  }

  acknowledge(result: CommandResult): RetriableCommand | undefined {
    const pending = this.#pending.get(result.requestId);
    if (pending === undefined || pending.command.type !== result.command) return undefined;
    this.#pending.delete(result.requestId);
    pending.complete?.(result.ok);
    return pending.command;
  }

  cancel(requestId: string): void {
    const pending = this.#pending.get(requestId);
    if (pending === undefined) return;
    this.#pending.delete(requestId);
    pending.complete?.(false);
  }

  clear(): void {
    const pending = [...this.#pending.values()];
    this.#pending.clear();
    for (const command of pending) command.complete?.(false);
  }
}
