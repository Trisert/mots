import { describe, expect, test } from "bun:test";
import { COMMAND_ERROR } from "@mots/protocol";
import {
  DAILY_PROMPT_KEY_PREFIX,
  dailyPromptKey,
  dailyPromptLimitFromEnv,
  DailyPromptLimitError,
  DEFAULT_DAILY_PROMPT_LIMIT,
  nextPromptCount,
  utcDay,
} from "../src/daily-limit.ts";

describe("dailyPromptLimitFromEnv", () => {
  test("uses the default when unset, empty, or invalid", () => {
    expect(dailyPromptLimitFromEnv(undefined)).toBe(DEFAULT_DAILY_PROMPT_LIMIT);
    expect(dailyPromptLimitFromEnv({})).toBe(DEFAULT_DAILY_PROMPT_LIMIT);
    expect(dailyPromptLimitFromEnv({ MOTS_DAILY_PROMPT_LIMIT: "  " })).toBe(DEFAULT_DAILY_PROMPT_LIMIT);
    expect(dailyPromptLimitFromEnv({ MOTS_DAILY_PROMPT_LIMIT: "0" })).toBe(DEFAULT_DAILY_PROMPT_LIMIT);
    expect(dailyPromptLimitFromEnv({ MOTS_DAILY_PROMPT_LIMIT: "10.5" })).toBe(DEFAULT_DAILY_PROMPT_LIMIT);
    expect(dailyPromptLimitFromEnv({ MOTS_DAILY_PROMPT_LIMIT: "99999" })).toBe(DEFAULT_DAILY_PROMPT_LIMIT);
  });

  test("accepts a bounded integer", () => {
    expect(dailyPromptLimitFromEnv({ MOTS_DAILY_PROMPT_LIMIT: "25" })).toBe(25);
  });
});

describe("nextPromptCount", () => {
  test("counts up to the limit and then refuses", () => {
    expect(nextPromptCount(0, 2)).toBe(1);
    expect(nextPromptCount(1, 2)).toBe(2);
    expect(nextPromptCount(2, 2)).toBeNull();
    expect(nextPromptCount(7, 2)).toBeNull();
  });

  test("treats a corrupt stored count as zero", () => {
    expect(nextPromptCount(-3, 2)).toBe(1);
    expect(nextPromptCount(Number.NaN, 2)).toBe(1);
  });
});

describe("daily keys", () => {
  test("groups timestamps by UTC day", () => {
    expect(utcDay(Date.UTC(2026, 9, 27, 0, 0, 1))).toBe("2026-10-27");
    expect(utcDay(Date.UTC(2026, 9, 27, 23, 59, 59))).toBe("2026-10-27");
    expect(dailyPromptKey(Date.UTC(2026, 9, 28, 0, 0, 0))).toBe(`${DAILY_PROMPT_KEY_PREFIX}2026-10-28`);
  });
});

describe("DailyPromptLimitError", () => {
  test("carries the stable refusal code and a message without internals", () => {
    const error = new DailyPromptLimitError(100);
    expect(error.code).toBe(COMMAND_ERROR.dailyLimitReached);
    expect(error.code).toBe("daily_limit_reached");
    expect(error.message).toContain("100");
    expect(error.message).toContain("00:00 UTC");
  });
});
