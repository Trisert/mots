/**
 * Formatting helpers for the transcript.
 *
 * Kept free of React Native imports so they can be unit tested with Bun, like `markdown.ts`.
 */

/**
 * Format a timestamp with the 24-hour clock and no AM/PM marker.
 *
 * The locale tag is explicit (`en-GB` or `it-IT` from the app's language), and `hour12: false` is
 * set because some locales render 12-hour time anyway.
 */
export function formatTime(timestamp: number | undefined, localeTag = "en-GB"): string | undefined {
  if (timestamp === undefined || !Number.isFinite(timestamp)) return undefined;
  const date = new Date(timestamp);
  // `toLocaleTimeString` does not throw on an invalid date: it returns the string "Invalid Date".
  if (Number.isNaN(date.getTime())) return undefined;
  try {
    return date.toLocaleTimeString(localeTag, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return undefined;
  }
}

/**
 * Format a date and time the way a reminder reads in the transcript.
 *
 * Same rules as `formatTime`: explicit locale tag, 24-hour clock, no AM/PM marker.
 */
export function formatDateTime(value: string | undefined, localeTag = "en-GB"): string | undefined {
  if (value === undefined) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  try {
    return date.toLocaleString(localeTag, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return undefined;
  }
}
