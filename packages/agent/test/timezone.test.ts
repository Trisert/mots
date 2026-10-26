import { describe, expect, test } from "bun:test";
import { applyTimezone, clockText, utcOffset } from "../src/timezone.ts";

describe("session timezone", () => {
  test("stores the latest timezone", () => {
    const doc: { timezone?: string } = {};
    applyTimezone(doc, "Europe/Rome");
    applyTimezone(doc, "America/New_York");
    expect(doc.timezone).toBe("America/New_York");
  });

  test("computes offsets across daylight saving time", () => {
    expect(utcOffset(Date.parse("2026-07-01T12:00:00Z"), "Europe/Rome")).toBe("+02:00");
    expect(utcOffset(Date.parse("2026-12-01T12:00:00Z"), "Europe/Rome")).toBe("+01:00");
    expect(utcOffset(Date.parse("2026-12-01T12:00:00Z"), "America/New_York")).toBe("-05:00");
    expect(utcOffset(Date.parse("2026-12-01T12:00:00Z"), "Asia/Kolkata")).toBe("+05:30");
    expect(utcOffset(Date.parse("2026-12-01T12:00:00Z"), "UTC")).toBe("+00:00");
  });

  test("keeps the UTC clock without a stored timezone", () => {
    expect(clockText(Date.parse("2026-10-26T08:42:10Z"), undefined)).toBe(
      "Current time: 2026-10-26T08:42Z. Unless the user states a timezone, treat times as UTC.",
    );
  });

  test("shows local wall-clock time with the stored timezone", () => {
    // 2026-10-25 is the last Sunday of October: Rome is back on +01:00.
    const text = clockText(Date.parse("2026-10-26T08:42:10Z"), "Europe/Rome");
    expect(text).toStartWith("Current time: 2026-10-26 09:42 in Europe/Rome (UTC+01:00).");
    expect(text).toContain("use Europe/Rome as recurrence.timezone");
  });
});
