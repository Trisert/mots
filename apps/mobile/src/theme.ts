import { Platform, type TextStyle } from "react-native";

/**
 * Mots visual system.
 *
 * Dark is the primary theme: warm black, cream type, and a sand accent used
 * only for focus, links, and quiet status. Light is the same structure on
 * warm paper, with a darker clay accent so text stays readable. Primary
 * actions are ink and cream, not a saturated fill.
 *
 * Legacy color names (accentCoral, cardSurfaceMint, …) stay so older
 * components keep compiling. New UI should prefer the semantic names.
 */

const ink = "#1C1915";
const paper = "#F6F3EC";
const cream = "#F4F0E8";
const sand = "#E7C4A8";
const clay = "#7A4632";

export const lightColors = {
  bgMain: paper,
  cardSurfacePrimary: "#FFFFFF",
  cardSurfaceAmber: "#F3EBE1",
  cardSurfaceMint: "#F3F6F2",
  cardSurfacePink: "#F8EEEB",
  accentCoral: clay,
  accentGreen: "#2F6B4F",
  starHighlight: clay,
  textPrimary: ink,
  textSecondary: "#5C564F",
  borderSubtle: "#E4DDD2",
  borderMedium: "#D4CBBF",

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
  avatarRed: clay,
  avatarTeal: "#3E5652",

  background: paper,
  surface: "#FFFFFF",
  surfaceRaised: "#FFFCF7",
  surfaceSoft: "#F3EFE8",
  border: "#E4DDD2",
  borderStrong: "#C9BDB0",
  text: ink,
  textMuted: "#5C564F",
  textFaint: "#65605A",
  accent: clay,
  accentSoft: "#F3EBE1",
  accentInk: paper,
  userBubble: "#E7E0D4",
  userBubbleText: ink,
  onAccentFaint: "#5C564F",
  danger: "#8E3E32",
  dangerSoft: "#F8EEEB",
  success: "#2F6B4F",
  overlay: "rgba(28, 25, 21, 0.42)",
  link: clay,
  frame: "#E6DFD4",
} as const;

export const darkColors = {
  bgMain: "#12110E",
  cardSurfacePrimary: "#1C1B17",
  cardSurfaceAmber: "#262119",
  cardSurfaceMint: "#1A211C",
  cardSurfacePink: "#261C1A",
  accentCoral: sand,
  accentGreen: "#B7D4C2",
  starHighlight: sand,
  textPrimary: cream,
  textSecondary: "#B7B1A6",
  borderSubtle: "rgba(244, 240, 232, 0.10)",
  borderMedium: "rgba(244, 240, 232, 0.18)",

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
  avatarOrange: sand,
  avatarRed: "#E7B2A8",
  avatarTeal: "#B7D0C8",

  background: "#12110E",
  surface: "#1C1B17",
  surfaceRaised: "#26241F",
  surfaceSoft: "#1A1916",
  border: "rgba(244, 240, 232, 0.10)",
  borderStrong: "rgba(244, 240, 232, 0.22)",
  text: cream,
  textMuted: "#B7B1A6",
  textFaint: "#8E887E",
  accent: sand,
  accentSoft: "rgba(231, 196, 168, 0.16)",
  accentInk: "#1A1612",
  userBubble: "#2A2723",
  userBubbleText: cream,
  onAccentFaint: "#B7B1A6",
  danger: "#E7B2A8",
  dangerSoft: "rgba(231, 178, 168, 0.14)",
  success: "#B7D4C2",
  overlay: "rgba(0, 0, 0, 0.62)",
  link: sand,
  frame: "#0B0A08",
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

export const radius = {
  xs: 8,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  card: 24,
  cardLarge: 28,
  pill: 9999,
} as const;

export const hit = 44;

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
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 3,
  },
  floating: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 6,
  },
} as const;
