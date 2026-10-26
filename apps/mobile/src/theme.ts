import { Platform, type TextStyle } from "react-native";

/**
 * Mots visual system, from the Mots design system
 * (https://claude.ai/artifact/HWoqJFg45sk4wqpKVKuMSW).
 *
 * Soft and rounded: a pale sky ground, white cards, three pastel fills (blush, mint, sky) that
 * always carry dark text, one black (light) or white (dark) action fill, and the speech-bubble
 * mascot. One family, Figtree; JetBrains Mono only for model ids and codes.
 */

import { lightColors, type ThemeColors } from "./palette.ts";

export { darkColors, lightColors, type ThemeColors } from "./palette.ts";

/** @deprecated Prefer useTheme().colors. This is the light palette for unused legacy components. */
export const colors: ThemeColors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  xs: 6,
  sm: 12,
  md: 20,
  lg: 20,
  xl: 32,
  card: 20,
  cardLarge: 32,
  /** Message bubbles; the tail corner is `xs`. */
  bubble: 22,
  composer: 9999,
  pill: 9999,
} as const;

export const hit = 44;

export const motion = {
  fast: 140,
  base: 220,
  slow: 380,
} as const;

const family = (web: string, native: string) => Platform.select({ web, default: native });
const SANS = "Figtree, 'Helvetica Neue', Arial, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

export const fonts = {
  regular: family(SANS, "Figtree_400Regular"),
  medium: family(SANS, "Figtree_500Medium"),
  semiBold: family(SANS, "Figtree_600SemiBold"),
  bold: family(SANS, "Figtree_700Bold"),
  extraBold: family(SANS, "Figtree_700Bold"),
  /** Display text. The system has one family, so these are Figtree at display weight. */
  serif: family(SANS, "Figtree_600SemiBold"),
  serifItalic: family(SANS, "Figtree_600SemiBold"),
  /** Model ids and codes only. */
  mono: family(MONO, "JetBrainsMono_400Regular"),
  monoMedium: family(MONO, "JetBrainsMono_500Medium"),
} as const;

const weight = {
  regular: "400",
  medium: "500",
  semiBold: "600",
  bold: "700",
} as const;

export const type = {
  /** The greeting. Once per screen. */
  display: {
    fontFamily: fonts.semiBold,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.5,
    fontWeight: weight.semiBold,
  },
  /** Onboarding questions and screen titles. */
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.3,
    fontWeight: weight.semiBold,
  },
  /** Section and card titles. */
  heading: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: weight.semiBold,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: weight.regular,
  },
  bodyMedium: {
    fontFamily: fonts.medium,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: weight.medium,
  },
  small: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: weight.regular,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: weight.medium,
  },
  caption: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: weight.medium,
  },
  /** Section labels. Always uppercase. */
  kicker: {
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    fontWeight: weight.medium,
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: weight.regular,
  },
} as const satisfies Record<string, TextStyle>;

const none = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0,
  shadowRadius: 0,
  elevation: 0,
} as const;

/** White cards lift off the light ground with one soft shadow; dark separates by value. */
const soft = {
  shadowColor: "#15171A",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.07,
  shadowRadius: 16,
  elevation: 2,
} as const;

export const shadows = {
  subtle: none,
  card: soft,
  floating: soft,
} as const;
