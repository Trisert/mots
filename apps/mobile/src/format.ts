/**
 * Formatting helpers for the transcript.
 *
 * Kept free of React Native imports so they can be unit tested with Bun, like `markdown.ts`.
 */

/**
 * Format a timestamp in the Italian convention: the 24-hour clock and no AM/PM marker.
 *
 * The locale is explicit because the device locale may be anything, and `hour12: false` is set
 * because some locales render 12-hour time even when the app is Italian.
 */
export function formatTime(timestamp: number | undefined): string | undefined {
  if (timestamp === undefined || !Number.isFinite(timestamp)) return undefined;
  const date = new Date(timestamp);
  // `toLocaleTimeString` does not throw on an invalid date: it returns the string "Invalid Date".
  if (Number.isNaN(date.getTime())) return undefined;
  try {
    return date.toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return undefined;
  }
}

/**
 * Format a date and time in the Italian convention, the way a reminder reads in the transcript.
 *
 * Same rules as `formatTime`: explicit locale, 24-hour clock, no AM/PM marker.
 */
export function formatDateTime(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  try {
    return date.toLocaleString("it-IT", {
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
