import { describe, expect, test } from "bun:test";
import { localeText, pushCopyFor, readStoredLocale } from "../src/locale.ts";

describe("reply language", () => {
  test("keeps the old instruction until the app reports a language", () => {
    expect(localeText(undefined)).toBe("Reply in the user's language.");
  });

  test("names the chosen language and holds it even when the user writes in another one", () => {
    expect(localeText("it")).toContain("Reply in Italian");
    expect(localeText("en")).toContain("Reply in English");
  });
});

describe("push copy", () => {
  test("uses Italian for an Italian session and English otherwise", () => {
    expect(pushCopyFor("it").routineStopped).toContain("Apri Mots");
    expect(pushCopyFor("en").routineStopped).toBe("Stopped after repeated failed runs. Open Mots to restart it.");
    expect(pushCopyFor(undefined).fallbackBody).toBe("A scheduled reminder is ready.");
  });
});

describe("readStoredLocale", () => {
  test("returns only supported languages", () => {
    expect(readStoredLocale({ locale: "it" })).toBe("it");
    expect(readStoredLocale({ locale: "fr" as "en" })).toBeUndefined();
    expect(readStoredLocale(undefined)).toBeUndefined();
  });
});
