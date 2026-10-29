import { DailyPromptLimitError, ImagesNotSupportedError, ModelNotAllowedError } from "@mots/agent";
import { COMMAND_ERROR } from "@mots/protocol";

export type CommandFailure = {
  readonly code: string;
  readonly message: string;
};

export function commandFailure(error: unknown): CommandFailure {
  if (
    error instanceof ModelNotAllowedError ||
    error instanceof DailyPromptLimitError ||
    error instanceof ImagesNotSupportedError
  ) {
    return { code: error.code, message: error.message };
  }
  return { code: COMMAND_ERROR.commandFailed, message: "Command failed" };
}
