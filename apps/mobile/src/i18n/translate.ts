// Pure translation helpers. No React or React Native imports, so Bun tests can load them.
import { messages, type MessageKey } from "./messages";

export type { MessageKey } from "./messages";
export type Locale = "en" | "it";
export type TranslateParams = Readonly<Record<string, string | number>>;
export type Translate = (key: MessageKey, params?: TranslateParams) => string;

export const LOCALES: readonly Locale[] = ["en", "it"];

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "it";
}

/** The device language decides the first run: Italian if the device is Italian, English otherwise. */
export function detectLocale(): Locale {
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale;
    return tag.toLowerCase().startsWith("it") ? "it" : "en";
  } catch {
    return "en";
  }
}

/** Fills `{name}` placeholders. A missing parameter keeps the placeholder visible. */
export function translate(locale: Locale, key: MessageKey, params?: TranslateParams): string {
  const template = messages[locale][key];
  if (params === undefined) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

/** For callers outside React (the API client and tests). Components pass `t` from `useI18n()`. */
export const englishTranslate: Translate = (key, params) => translate("en", key, params);
