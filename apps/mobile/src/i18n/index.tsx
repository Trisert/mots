import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  detectLocale,
  isLocale,
  translate,
  type Locale,
  type Translate,
} from "./translate";

export * from "./translate";

export const LOCALE_STORAGE_KEY = "mots.locale.v1";

export interface LocaleContextValue {
  readonly locale: Locale;
  readonly setLocale: (locale: Locale) => void;
  readonly t: Translate;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  setLocale: () => {},
  t: (key, params) => translate("en", key, params),
});

export function LocaleProvider({ children }: { readonly children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  useEffect(() => {
    let alive = true;
    // A stored choice wins over the device language. Read errors keep the device default.
    AsyncStorage.getItem(LOCALE_STORAGE_KEY)
      .then((stored) => {
        if (alive && isLocale(stored)) setLocaleState(stored);
      })
      .catch(() => {
        // ignore read errors
      });
    return () => {
      alive = false;
    };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    AsyncStorage.setItem(LOCALE_STORAGE_KEY, next).catch(() => {
      // ignore storage write errors
    });
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, params) => translate(locale, key, params),
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n(): LocaleContextValue {
  return useContext(LocaleContext);
}
