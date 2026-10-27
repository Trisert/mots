import { defineDoc, section } from "@earendil-works/pi-durable";
import type { SessionLocale } from "@mots/protocol";

/** The app language chosen by the user. A later choice replaces it. */
export const LocaleDoc = defineDoc<{ locale?: SessionLocale }>({
  kind: "app.locale",
  version: 1,
  scope: "session",
  initial: () => ({}),
});

/** Store a locale that `parseClientCommand` already accepted. */
export function applyLocale(doc: { locale?: SessionLocale }, locale: SessionLocale): void {
  doc.locale = locale;
}

const LANGUAGE_NAMES: Record<SessionLocale, string> = {
  en: "English",
  it: "Italian",
};

/**
 * The reply-language line of the system prompt. Without a stored locale the model
 * follows the language of the user's messages, as it did before the app had a setting.
 */
export function localeText(locale: SessionLocale | undefined): string {
  if (locale === undefined) return "Reply in the user's language.";
  return (
    `The user chose ${LANGUAGE_NAMES[locale]} in the app. Reply in ${LANGUAGE_NAMES[locale]}, ` +
    "even when the user writes in another language, unless they explicitly ask for a different language. " +
    "This applies to routine reports too."
  );
}

/** Push copy for the chosen language. English is the default. */
export type PushCopy = {
  readonly fallbackBody: string;
  readonly routineStopped: string;
};

const PUSH_COPY: Record<SessionLocale, PushCopy> = {
  en: {
    fallbackBody: "A scheduled reminder is ready.",
    routineStopped: "Stopped after repeated failed runs. Open Mots to restart it.",
  },
  it: {
    fallbackBody: "Un promemoria programmato è pronto.",
    routineStopped: "Fermata dopo ripetute esecuzioni fallite. Apri Mots per riavviarla.",
  },
};

export const pushCopyFor = (locale: SessionLocale | undefined): PushCopy =>
  PUSH_COPY[locale ?? "en"];

/** The stored locale, or `undefined` before the app has reported one. */
export function readStoredLocale(doc: { locale?: SessionLocale } | undefined): SessionLocale | undefined {
  return doc?.locale === "en" || doc?.locale === "it" ? doc.locale : undefined;
}

export const localeSection = section(
  "locale",
  async (input, context) => localeText(readStoredLocale(await input.read.snapshot(LocaleDoc, context))),
  { tag: false },
);
