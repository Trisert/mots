import { Platform, type TextStyle } from "react-native";

/**
 * Flat near-black and near-white. One stone accent, used only on the primary
 * action and the send button. Legacy color names stay so unused components compile.
 */

const ink = "#121211";
const paper = "#F7F7F5";
const cream = "#F3F3F1";
const accent = "#6E5A4C";
const accentInk = "#F7F6F3";

export const lightColors = {
  bgMain: paper,
  cardSurfacePrimary: paper,
  cardSurfaceAmber: paper,
  cardSurfaceMint: paper,
  cardSurfacePink: paper,
  accentCoral: accent,
  accentGreen: "#3E3E3C",
  starHighlight: ink,
  textPrimary: ink,
  textSecondary: "#6E6E6A",
  borderSubtle: "#E2E2DE",
  borderMedium: "#D0D0CC",

  codeSurface: ink,
  codeSurfaceHeader: "#141210",
  codeText: cream,
  codeMuted: "#B7B1A6",
  reasoningSurface: "#F3EFE8",
  reasoningBorder: "#E4DDD2",
  reasoningText: "#3E3A35",
  cardBorderSubtle: "#E4DDD2",
  badgeMintBg: "#E5F0E8",
  badgeMintText: "#1E4632",
  badgeAmberBg: "#F3EBE1",
  badgeAmberText: "#6A4528",
  badgePinkBg: "#F8EEEB",
  badgePinkText: "#7A3328",

  avatarPurple: "#5C534A",
  avatarBlue: "#4E5A62",
  avatarGreen: "#3E5C4A",
  avatarOrange: "#8A5A3A",
  avatarRed: accent,
  avatarTeal: "#3E5652",

  background: paper,
  surface: paper,
  surfaceRaised: paper,
  surfaceSoft: "#EEEEEC",
  border: "#E2E2DE",
  borderStrong: "#C8C8C4",
  text: ink,
  textMuted: "#6E6E6A",
  textFaint: "#8A8A86",
  accent,
  accentSoft: paper,
  accentInk,
  userBubble: "#EEEEEC",
  userBubbleText: ink,
  onAccentFaint: "#5C564F",
  danger: "#8E3E32",
  dangerSoft: "#F8EEEB",
  success: "#2F6B4F",
  overlay: "rgba(28, 25, 21, 0.42)",
  link: ink,
  frame: paper,
} as const;

export const darkColors = {
  bgMain: "#0E0E0D",
  cardSurfacePrimary: "#0E0E0D",
  cardSurfaceAmber: "#0E0E0D",
  cardSurfaceMint: "#0E0E0D",
  cardSurfacePink: "#0E0E0D",
  accentCoral: accent,
  accentGreen: "#C8C8C4",
  starHighlight: cream,
  textPrimary: cream,
  textSecondary: "#8E8E8A",
  borderSubtle: "#2C2C2A",
  borderMedium: "#3A3A38",

  codeSurface: "#0E0D0B",
  codeSurfaceHeader: "#0A0908",
  codeText: cream,
  codeMuted: "#B7B1A6",
  reasoningSurface: "#1A1916",
  reasoningBorder: "rgba(244, 240, 232, 0.10)",
  reasoningText: "#D9D3C8",
  cardBorderSubtle: "rgba(244, 240, 232, 0.10)",
  badgeMintBg: "rgba(183, 212, 194, 0.14)",
  badgeMintText: "#D5E8DC",
  badgeAmberBg: "rgba(231, 196, 168, 0.14)",
  badgeAmberText: "#F0D7C4",
  badgePinkBg: "rgba(231, 178, 168, 0.14)",
  badgePinkText: "#F0D0C8",

  avatarPurple: "#A39890",
  avatarBlue: "#9AA7AE",
  avatarGreen: "#B7D4C2",
  avatarOrange: accent,
  avatarRed: "#E7B2A8",
  avatarTeal: "#B7D0C8",

  background: "#0E0E0D",
  surface: "#0E0E0D",
  surfaceRaised: "#0E0E0D",
  surfaceSoft: "#1A1A18",
  border: "#2C2C2A",
  borderStrong: "#3A3A38",
  text: cream,
  textMuted: "#8E8E8A",
  textFaint: "#6E6E6A",
  accent,
  accentSoft: "#0E0E0D",
  accentInk,
  userBubble: "#1C1C1A",
  userBubbleText: cream,
  onAccentFaint: "#B7B1A6",
  danger: "#E7B2A8",
  dangerSoft: "rgba(231, 178, 168, 0.14)",
  success: "#B7D4C2",
  overlay: "rgba(0, 0, 0, 0.62)",
  link: cream,
  frame: "#0E0E0D",
} as const;

export type ThemeColors = {
  [K in keyof typeof lightColors]: string;
};

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

/** One radius scale. full is the pill and circle. Older names alias these steps. */
export const radius = {
  sm: 12,
  md: 18,
  lg: 24,
  full: 9999,
  xs: 12,
  xl: 24,
  card: 24,
  cardLarge: 24,
  pill: 9999,
} as const;

export const hit = 44;

/** Shared screen and sheet inset. Rows, headers, and lists use this once. */
export const inset = 28;

export const motion = {
  fast: 140,
  base: 220,
  slow: 380,
} as const;

export const fonts = {
  regular: Platform.select({
    web: "Instrument Sans, system-ui, sans-serif",
    default: "InstrumentSans_400Regular",
  }),
  medium: Platform.select({
    web: "Instrument Sans, system-ui, sans-serif",
    default: "InstrumentSans_500Medium",
  }),
  semiBold: Platform.select({
    web: "Instrument Sans, system-ui, sans-serif",
    default: "InstrumentSans_600SemiBold",
  }),
  bold: Platform.select({
    web: "Instrument Sans, system-ui, sans-serif",
    default: "InstrumentSans_700Bold",
  }),
  extraBold: Platform.select({
    web: "Instrument Sans, system-ui, sans-serif",
    default: "InstrumentSans_700Bold",
  }),
} as const;

const weight = {
  regular: "400",
  medium: "500",
  semiBold: "600",
  bold: "700",
} as const;

export const type = {
  display: {
    fontFamily: fonts.bold,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1.2,
    fontWeight: weight.bold,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.6,
    fontWeight: weight.bold,
  },
  heading: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
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
    lineHeight: 24,
    fontWeight: weight.medium,
  },
  small: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: weight.regular,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: weight.medium,
  },
  caption: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: weight.medium,
  },
} as const satisfies Record<string, TextStyle>;

export const shadows = {
  subtle: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  card: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  floating: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
} as const;
