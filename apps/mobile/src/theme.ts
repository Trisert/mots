export const colors = {
  // Warm Daylight palette (primary theme)
  bgMain: "#EAE6DF",
  cardSurfacePrimary: "#FAF8F5",
  cardSurfaceAmber: "#F6DFB1",
  cardSurfaceMint: "#B7F09B",
  cardSurfacePink: "#F2B8C6",
  accentCoral: "#E86A63",
  accentGreen: "#78C864",
  starHighlight: "#F5DF98",
  textPrimary: "#1C1C1E",
  textSecondary: "#6E6D6A",
  borderSubtle: "#1C1C1E",

  // Backward-compatible aliases (mapped to Warm Daylight)
  background: "#EAE6DF",
  surface: "#FAF8F5",
  surfaceRaised: "#F6DFB1",
  surfaceSoft: "#F2B8C6",
  border: "#1C1C1E",
  borderStrong: "#1C1C1E",
  text: "#1C1C1E",
  textMuted: "#6E6D6A",
  textFaint: "#6E6D6A",
  accent: "#E86A63",
  accentSoft: "#F6DFB1",
  accentInk: "#FFFFFF",
  userBubble: "#F6DFB1",
  onAccentFaint: "#6E6D6A",
  danger: "#E86A63",
  dangerSoft: "#F2B8C6",
  success: "#78C864",
  overlay: "rgba(0, 0, 0, 0.4)",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  xl: 28,
  card: 28,
  pill: 9999,
} as const;