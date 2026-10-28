import { COMMAND_ERROR } from "@mots/protocol";
import type { MotsEnvironment } from "./provider.ts";

/**
 * User prompts a session may submit per UTC day. This is a proxy for spend: each prompt can start
 * a paid model turn. It is replaced by a cost cap once the harness reports usage per turn.
 */
export const DEFAULT_DAILY_PROMPT_LIMIT = 100;
const MAX_DAILY_PROMPT_LIMIT = 10_000;

/** Storage key prefix. The day is appended so each day has its own counter. */
export const DAILY_PROMPT_KEY_PREFIX = "limit:prompts:";

/** Invalid or empty values keep the default. They never raise the cap. */
export function dailyPromptLimitFromEnv(env: MotsEnvironment | undefined): number {
  const value = env?.MOTS_DAILY_PROMPT_LIMIT;
  if (value === undefined || value.trim().length === 0) return DEFAULT_DAILY_PROMPT_LIMIT;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_DAILY_PROMPT_LIMIT) {
    return DEFAULT_DAILY_PROMPT_LIMIT;
  }
  return parsed;
}

/** The UTC calendar day, as `YYYY-MM-DD`, that a timestamp falls in. */
export function utcDay(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export const dailyPromptKey = (timestamp: number): string =>
  `${DAILY_PROMPT_KEY_PREFIX}${utcDay(timestamp)}`;

/** Refusal for `prompt.submit` once the day's allowance is used. The message is safe to show. */
export class DailyPromptLimitError extends Error {
  readonly code = COMMAND_ERROR.dailyLimitReached;

  constructor(limit: number) {
    super(`This session reached its limit of ${limit} messages today. It resets at 00:00 UTC.`);
    this.name = "DailyPromptLimitError";
  }
}

/**
 * The count after one more prompt, or null when the day's allowance is already used. A refused
 * prompt is not counted.
 */
export function nextPromptCount(current: number, limit: number): number | null {
  const count = Number.isSafeInteger(current) && current > 0 ? current : 0;
  return count < limit ? count + 1 : null;
}

export function releasedPromptCount(current: number): number {
  return Number.isSafeInteger(current) && current > 0 ? current - 1 : 0;
}
