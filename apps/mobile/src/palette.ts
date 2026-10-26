/**
 * Mots colour palettes. No React Native import, so the contrast tests can
 * load these values under plain Bun. theme.ts re-exports everything here.
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
  userBubble: vellum,
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
  /** Raised input surfaces such as the composer, and their quiet outline. */
  field: chalk,
  fieldBorder: "#7E7C77",
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
  userBubble: "#262624",
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
  field: "#141413",
  fieldBorder: "#64635C",
} as const;

export type ThemeColors = {
  [K in keyof typeof lightColors]: string;
};
