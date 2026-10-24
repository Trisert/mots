import { Platform } from "react-native";

export const lightColors = {
  // Editorial Greeting & Anti-slop palette (from .taste-skill/direction.json)
  bgMain: "#ffffff",
  cardSurfacePrimary: "#f9f9f9",
  cardSurfaceAmber: "#fbf8ef",
  cardSurfaceMint: "#f0f8f3",
  cardSurfacePink: "#fdf2f2",
  accentCoral: "#1b6e66",
  accentGreen: "#2e7d32",
  starHighlight: "#d97706",
  textPrimary: "#1f201d",
  textSecondary: "#636361",
  borderSubtle: "#eaeaea",
  borderMedium: "#d9d9d6",

  // Autonomous Agent tokens (Grok Bot & Editorial style)
  codeSurface: "#1a1b1e",
  codeSurfaceHeader: "#131416",
  codeText: "#f4f4f5",
  codeMuted: "#8e8e93",
  reasoningSurface: "#f9f9f8",
  reasoningBorder: "#eaeaea",
  reasoningText: "#424240",
  cardBorderSubtle: "#eaeaea",
  badgeMintBg: "#dcfae5",
  badgeMintText: "#04250e",
  badgeAmberBg: "#fffbeb",
  badgeAmberText: "#92400e",
  badgePinkBg: "#fdecea",
  badgePinkText: "#7a1d14",

  // Agent Avatar Colors
  avatarPurple: "#6366f1",
  avatarBlue: "#2563eb",
  avatarGreen: "#16a34a",
  avatarOrange: "#ea580c",
  avatarRed: "#dc2626",
  avatarTeal: "#0d9488",

  // Backward-compatible aliases
  background: "#ffffff",
  surface: "#f9f9f9",
  surfaceRaised: "#ffffff",
  surfaceSoft: "#f3f3f3",
  border: "#eaeaea",
  borderStrong: "#1f201d",
  text: "#1f201d",
  textMuted: "#636361",
  textFaint: "#8c8c88",
  accent: "#1b6e66",
  accentSoft: "#dcfae5",
  accentInk: "#ffffff",
  userBubble: "#1f201d",
  userBubbleText: "#ffffff",
  onAccentFaint: "#636361",
  danger: "#b42318",
  dangerSoft: "#fdecea",
  success: "#2e7d32",
  overlay: "rgba(0, 0, 0, 0.4)",
} as const;

export const darkColors = {
  // Editorial Greeting & Dark Mode OLED palette (Material 3 / Grok / ChatGPT style)
  bgMain: "#0D0E12",
  cardSurfacePrimary: "#16171D",
  cardSurfaceAmber: "#1E1B14",
  cardSurfaceMint: "#121E17",
  cardSurfacePink: "#221417",
  accentCoral: "#2DD4BF",
  accentGreen: "#4ADE80",
  starHighlight: "#FBBF24",
  textPrimary: "#F5F5F7",
  textSecondary: "#9E9EA4",
  borderSubtle: "rgba(255, 255, 255, 0.08)",
  borderMedium: "rgba(255, 255, 255, 0.16)",

  // Autonomous Agent tokens (Grok Bot & High Contrast Dark)
  codeSurface: "#101116",
  codeSurfaceHeader: "#0A0B0E",
  codeText: "#F4F4F5",
  codeMuted: "#71717A",
  reasoningSurface: "#13141A",
  reasoningBorder: "rgba(255, 255, 255, 0.08)",
  reasoningText: "#D4D4D8",
  cardBorderSubtle: "rgba(255, 255, 255, 0.08)",
  badgeMintBg: "rgba(74, 222, 128, 0.16)",
  badgeMintText: "#4ADE80",
  badgeAmberBg: "rgba(251, 191, 36, 0.16)",
  badgeAmberText: "#FBBF24",
  badgePinkBg: "rgba(248, 113, 113, 0.16)",
  badgePinkText: "#F87171",

  // Agent Avatar Colors (calibrated for dark background)
  avatarPurple: "#818CF8",
  avatarBlue: "#60A5FA",
  avatarGreen: "#4ADE80",
  avatarOrange: "#FB923C",
  avatarRed: "#F87171",
  avatarTeal: "#2DD4BF",

  // Backward-compatible aliases
  background: "#0D0E12",
  surface: "#16171D",
  surfaceRaised: "#202129",
  surfaceSoft: "#1A1B22",
  border: "rgba(255, 255, 255, 0.08)",
  borderStrong: "rgba(255, 255, 255, 0.24)",
  text: "#F5F5F7",
  textMuted: "#9E9EA4",
  textFaint: "#71717A",
  accent: "#2DD4BF",
  accentSoft: "rgba(45, 212, 191, 0.16)",
  accentInk: "#0D0E12",
  userBubble: "#2A2B35",
  userBubbleText: "#F5F5F7",
  onAccentFaint: "#9E9EA4",
  danger: "#F87171",
  dangerSoft: "rgba(248, 113, 113, 0.16)",
  success: "#4ADE80",
  overlay: "rgba(0, 0, 0, 0.7)",
} as const;

export type ThemeColors = {
  [K in keyof typeof lightColors]: string;
};

export const colors: ThemeColors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 22,
  card: 22,
  cardLarge: 24,
  pill: 9999,
} as const;

export const fonts = {
  regular: Platform.select({ web: "Instrument Sans, system-ui, sans-serif", default: "InstrumentSans_400Regular" }),
  medium: Platform.select({ web: "Instrument Sans, system-ui, sans-serif", default: "InstrumentSans_500Medium" }),
  semiBold: Platform.select({ web: "Instrument Sans, system-ui, sans-serif", default: "InstrumentSans_600SemiBold" }),
  bold: Platform.select({ web: "Instrument Sans, system-ui, sans-serif", default: "InstrumentSans_700Bold" }),
  extraBold: Platform.select({ web: "Instrument Sans, system-ui, sans-serif", default: "InstrumentSans_700Bold" }),
} as const;

export const shadows = {
  subtle: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  floating: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;
