import { describe, expect, test } from "bun:test";
import { formatDateTime, formatTime } from "../src/format.ts";

describe("formatTime", () => {
  test("renders the 24-hour clock", () => {
    // 15:04 UTC, in a timezone where the local time is the same.
    const noon = Date.UTC(2026, 0, 2, 12, 0, 0);
    const formatted = formatTime(noon);
    expect(formatted).toBeDefined();
    // The Italian convention: two digits, a colon, no AM/PM marker.
    expect(formatted).toMatch(/^\d{2}:\d{2}$/);
  });

  test("never renders an AM/PM marker", () => {
    for (const hour of [0, 6, 12, 13, 18, 23]) {
      const formatted = formatTime(Date.UTC(2026, 0, 2, hour, 30, 0));
      expect(formatted).not.toMatch(/AM|PM/i);
      expect(formatted).not.toMatch(/[a-zA-Z]/);
    }
  });

  test("returns undefined without a timestamp", () => {
    expect(formatTime(undefined)).toBeUndefined();
  });

  test("returns undefined for an invalid timestamp", () => {
    expect(formatTime(Number.NaN)).toBeUndefined();
  });
});

describe("formatDateTime", () => {
  test("renders the day, the month and the 24-hour clock", () => {
    const formatted = formatDateTime("2026-03-15T14:30:00.000Z");
    expect(formatted).toBeDefined();
    expect(formatted).toMatch(/15/);
    expect(formatted).toMatch(/Mar/);
    expect(formatted).not.toMatch(/AM|PM/i);
  });

  test("returns undefined for an unparseable value", () => {
    expect(formatDateTime("not a date")).toBeUndefined();
    expect(formatDateTime(undefined)).toBeUndefined();
  });
});
