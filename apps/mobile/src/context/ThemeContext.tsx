import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { darkColors, lightColors, type ThemeColors } from "../theme";

export type ThemeMode = "light" | "dark" | "system";
export type ActiveTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "@mots/theme_preference";

export interface ThemeContextValue {
  readonly theme: ActiveTheme;
  readonly mode: ThemeMode;
  readonly setMode: (mode: ThemeMode) => void;
  readonly colors: ThemeColors;
  readonly isDark: boolean;
}

const defaultContext: ThemeContextValue = {
  theme: "light",
  mode: "system",
  setMode: () => {},
  colors: lightColors,
  isDark: false,
};

const ThemeContext = createContext<ThemeContextValue>(defaultContext);

export function ThemeProvider({ children }: { readonly children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (!alive || !stored) return;
        if (stored === "light" || stored === "dark" || stored === "system") {
          setModeState(stored);
        }
      })
      .catch(() => {
        // ignore read errors
      });
    return () => {
      alive = false;
    };
  }, []);

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);
    void AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode).catch(() => {
      // ignore storage write errors
    });
  }, []);

  const theme: ActiveTheme = useMemo(() => {
    if (mode === "dark") return "dark";
    if (mode === "light") return "light";
    return systemScheme === "dark" ? "dark" : "light";
  }, [mode, systemScheme]);

  const isDark = theme === "dark";
  const colors = isDark ? darkColors : lightColors;

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      mode,
      setMode,
      colors,
      isDark,
    }),
    [theme, mode, setMode, colors, isDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
