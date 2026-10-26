/**
 * Mots colour palettes, from the Mots design system
 * (https://claude.ai/artifact/HWoqJFg45sk4wqpKVKuMSW). No React Native import, so the contrast
 * tests can load these values under plain Bun. theme.ts re-exports everything here.
 *
 * The first block of each palette is the design system's own tokens. The rest are the names the
 * components already use, mapped onto those tokens.
 */

const light = {
  ground: "#ECF2F4",
  card: "#FFFFFF",
  sunk: "#F2F5F7",
  line: "#DCE3E8",
  ink: "#15171A",
  inkMuted: "#5A6169",
  action: "#15171A",
  onAction: "#FFFFFF",
  inverse: "#1C1E21",
  onInverse: "#F4F6F7",
  blush: "#F7B6DA",
  mint: "#94EDC8",
  sky: "#93DCEC",
  blushSoft: "#FDE6F2",
  mintSoft: "#DDFAEE",
  skySoft: "#DEF4F9",
  inkOnPastel: "#15171A",
  danger: "#B42318",
  focus: "#0E6F86",
  /** Input outlines: 3:1 against the ground and the card (WCAG 1.4.11). */
  fieldBorder: "#76818B",
} as const;

const dark = {
  ground: "#0F1012",
  card: "#1C1E21",
  sunk: "#26292D",
  line: "#34383D",
  ink: "#F4F6F7",
  inkMuted: "#A4ABB2",
  action: "#FFFFFF",
  onAction: "#15171A",
  inverse: "#2C2F33",
  onInverse: "#F4F6F7",
  blush: "#F4A7D2",
  mint: "#86E6BE",
  sky: "#86D4E6",
  blushSoft: "#3A2431",
  mintSoft: "#1E3A2F",
  skySoft: "#1B3540",
  inkOnPastel: "#15171A",
  danger: "#FF9B91",
  focus: "#93DCEC",
  fieldBorder: "#717981",
} as const;

type Tokens = { readonly [K in keyof typeof light]: string };

function palette(t: Tokens, overlay: string) {
  return {
    ...t,

    bgMain: t.ground,
    background: t.ground,
    frame: t.ground,
    surface: t.card,
    surfaceRaised: t.card,
    surfaceSoft: t.sunk,
    cardSurfacePrimary: t.card,
    cardSurfaceAmber: t.blushSoft,
    cardSurfaceMint: t.mintSoft,
    cardSurfacePink: t.blushSoft,
    field: t.card,

    textPrimary: t.ink,
    textSecondary: t.inkMuted,
    textFaint: t.inkMuted,
    text: t.ink,
    textMuted: t.inkMuted,
    link: t.ink,

    borderSubtle: t.line,
    borderMedium: t.inkMuted,
    border: t.line,
    borderStrong: t.ink,
    cardBorderSubtle: t.line,
    rule: t.ink,

    accent: t.action,
    accentInk: t.onAction,
    accentSoft: t.skySoft,
    accentCoral: t.ink,
    accentGreen: t.ink,
    starHighlight: t.ink,
    onAccentFaint: t.inkMuted,
    invertBg: t.action,
    invertFg: t.onAction,

    userBubble: t.card,
    userBubbleText: t.ink,

    codeSurface: t.inverse,
    codeSurfaceHeader: t.inverse,
    codeText: t.onInverse,
    codeMuted: "#A4ABB2",
    reasoningSurface: t.sunk,
    reasoningBorder: t.line,
    reasoningText: t.ink,

    badgeMintBg: t.mint,
    badgeMintText: t.inkOnPastel,
    badgeAmberBg: t.blush,
    badgeAmberText: t.inkOnPastel,
    badgePinkBg: t.blush,
    badgePinkText: t.inkOnPastel,

    avatarPurple: t.sky,
    avatarBlue: t.sky,
    avatarGreen: t.mint,
    avatarOrange: t.blush,
    avatarRed: t.blush,
    avatarTeal: t.mint,

    dangerSoft: t.sunk,
    success: t.ink,
    overlay,
  };
}

export const lightColors = palette(light, "rgba(21, 23, 26, 0.38)");
export const darkColors = palette(dark, "rgba(0, 0, 0, 0.7)");

export type ThemeColors = {
  [K in keyof typeof lightColors]: string;
};
