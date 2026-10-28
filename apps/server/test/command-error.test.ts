import { describe, expect, test } from "bun:test";
import { DailyPromptLimitError, ModelNotAllowedError } from "@mots/agent";
import { COMMAND_ERROR } from "@mots/protocol";
import { commandFailure } from "../src/command-error.ts";

describe("commandFailure", () => {
  test("keeps the safe model refusal code and message", () => {
    expect(commandFailure(new ModelNotAllowedError())).toEqual({
      code: COMMAND_ERROR.modelNotAllowed,
      message: "That model is not available.",
    });
  });

  test("keeps the safe daily prompt limit code and message", () => {
    expect(commandFailure(new DailyPromptLimitError(100))).toEqual({
      code: COMMAND_ERROR.dailyLimitReached,
      message: "This session reached its limit of 100 messages today. It resets at 00:00 UTC.",
    });
  });

  test("hides ordinary error messages", () => {
    expect(commandFailure(new Error("Conversation 7 does not exist"))).toEqual({
      code: COMMAND_ERROR.commandFailed,
      message: "Command failed",
    });
  });

  test("hides non-error thrown values", () => {
    expect(commandFailure({ detail: "internal failure" })).toEqual({
      code: COMMAND_ERROR.commandFailed,
      message: "Command failed",
    });
  });
});
