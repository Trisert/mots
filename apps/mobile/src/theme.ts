import { Platform, type TextStyle } from "react-native";

/**
 * Mots visual system, adapted from the NRights design system.
 *
 * Monochrome, warm, flat. Light is the Gallery (ink on bone), dark is the
 * Dark Room (paper on ink). There is no accent colour: emphasis is inversion
 * (ink fill, paper text, or the reverse), weight, and size. No shadows, no
 * gradients; hairlines carry structure. Serif is for moments, the grotesk and
 * the mono are for systems.
 *
 * Legacy color names (accentCoral, cardSurfaceMint, …) stay so older
 * components keep compiling. They now resolve to the same few tones.
 */

const ink = "#000000";
const paper = "#FFFFFF";
const bone = "#E7E5E4";
const putty = "#C4C3B6";
const graphite = "#595855";
const vellum = "#DFDCD5";
const chalk = "#EBEBEB";

export const lightColors = {
  bgMain: bone,
  cardSurfacePrimary: bone,
  cardSurfaceAmber: bone,
  cardSurfaceMint: bone,
  cardSurfacePink: bone,
  accentCoral: ink,
  accentGreen: ink,
  starHighlight: ink,
  textPrimary: ink,
  textSecondary: graphite,
  borderSubtle: vellum,
  borderMedium: graphite,

  codeSurface: ink,
  codeSurfaceHeader: ink,
  codeText: paper,
  codeMuted: putty,
  reasoningSurface: bone,
  reasoningBorder: graphite,
  reasoningText: ink,
  cardBorderSubtle: graphite,
  badgeMintBg: ink,
  badgeMintText: paper,
  badgeAmberBg: bone,
  badgeAmberText: ink,
  badgePinkBg: ink,
  badgePinkText: paper,

  avatarPurple: ink,
  avatarBlue: ink,
  avatarGreen: ink,
  avatarOrange: ink,
  avatarRed: ink,
  avatarTeal: ink,

  background: bone,
  surface: bone,
  surfaceRaised: chalk,
  surfaceSoft: vellum,
  border: graphite,
  borderStrong: ink,
  text: ink,
  textMuted: graphite,
  textFaint: graphite,
  accent: ink,
  accentSoft: vellum,
  accentInk: paper,
  userBubble: bone,
  userBubbleText: ink,
  onAccentFaint: graphite,
  danger: ink,
  dangerSoft: vellum,
  success: ink,
  overlay: "rgba(0, 0, 0, 0.42)",
  link: ink,
  frame: chalk,
  /** The one highlight: inverted fill and the text set on it. */
  invertBg: ink,
  invertFg: paper,
  rule: ink,
} as const;

export const darkColors = {
  bgMain: ink,
  cardSurfacePrimary: ink,
  cardSurfaceAmber: ink,
  cardSurfaceMint: ink,
  cardSurfacePink: ink,
  accentCoral: paper,
  accentGreen: paper,
  starHighlight: paper,
  textPrimary: paper,
  textSecondary: putty,
  borderSubtle: graphite,
  borderMedium: graphite,

  codeSurface: "#0F0F0E",
  codeSurfaceHeader: ink,
  codeText: paper,
  codeMuted: putty,
  reasoningSurface: ink,
  reasoningBorder: graphite,
  reasoningText: paper,
  cardBorderSubtle: graphite,
  badgeMintBg: paper,
  badgeMintText: ink,
  badgeAmberBg: ink,
  badgeAmberText: paper,
  badgePinkBg: paper,
  badgePinkText: ink,

  avatarPurple: paper,
  avatarBlue: paper,
  avatarGreen: paper,
  avatarOrange: paper,
  avatarRed: paper,
  avatarTeal: paper,

  background: ink,
  surface: ink,
  surfaceRaised: "#141413",
  surfaceSoft: "#1C1C1A",
  border: graphite,
  borderStrong: paper,
  text: paper,
  textMuted: putty,
  textFaint: putty,
  accent: paper,
  accentSoft: "#1C1C1A",
  accentInk: ink,
  userBubble: ink,
  userBubbleText: paper,
  onAccentFaint: putty,
  danger: paper,
  dangerSoft: "#1C1C1A",
  success: paper,
  overlay: "rgba(0, 0, 0, 0.7)",
  link: paper,
  frame: "#0F0F0E",
  invertBg: paper,
  invertFg: ink,
  rule: paper,
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
  xs: 6,
  sm: 9,
  md: 9,
  lg: 9,
  xl: 9,
  card: 9,
  cardLarge: 9,
  pill: 9999,
} as const;

export const hit = 44;

export const motion = {
  fast: 140,
  base: 220,
  slow: 380,
} as const;

const family = (web: string, native: string) => Platform.select({ web, default: native });
const SANS = "Inter, 'Helvetica Neue', Arial, sans-serif";
const SERIF = "'Instrument Serif', 'Playfair Display', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

export const fonts = {
  regular: family(SANS, "Inter_400Regular"),
  medium: family(SANS, "Inter_500Medium"),
  semiBold: family(SANS, "Inter_600SemiBold"),
  bold: family(SANS, "Inter_600SemiBold"),
  extraBold: family(SANS, "Inter_600SemiBold"),
  /** Moments: greetings, the wordmark, large values. Never labels or body copy. */
  serif: family(SERIF, "InstrumentSerif_400Regular"),
  serifItalic: family(SERIF, "InstrumentSerif_400Regular_Italic"),
  /** Systems: times, model ids, tool names, codes, markers. */
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
  display: {
    fontFamily: fonts.serif,
    fontSize: 48,
    lineHeight: 46,
    letterSpacing: -1.2,
    fontWeight: weight.regular,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 36,
    lineHeight: 36,
    letterSpacing: -0.8,
    fontWeight: weight.regular,
  },
  heading: {
    fontFamily: fonts.serif,
    fontSize: 26,
    lineHeight: 28,
    letterSpacing: -0.5,
    fontWeight: weight.regular,
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
  /** Kickers and room labels. Always uppercase. */
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

const flat = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0,
  shadowRadius: 0,
  elevation: 0,
} as const;

/** The system is flat. Kept so older call sites compile; every level is no shadow. */
export const shadows = {
  subtle: flat,
  card: flat,
  floating: flat,
} as const;
