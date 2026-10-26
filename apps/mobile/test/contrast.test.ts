import { describe, expect, test } from "bun:test";
// palette.ts, not theme.ts: theme.ts imports react-native, which Bun cannot load.
import { darkColors, lightColors } from "../src/palette.ts";

/** WCAG 2.1 relative luminance of an sRGB hex colour (#RGB or #RRGGBB). */
function relativeLuminance(hex: string): number {
  const digits = hex.replace("#", "");
  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((c) => c + c)
          .join("")
      : digits;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(full.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG contrast ratio between two opaque hex colours. */
function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const palettes = { light: lightColors, dark: darkColors } as const;

describe("contrastRatio", () => {
  test("matches the WCAG reference values for black and white", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });
});

for (const [name, palette] of Object.entries(palettes)) {
  describe(`${name} palette contrast`, () => {
    test("field outline is at least 3:1 against the page and the field fill", () => {
      expect(contrastRatio(palette.fieldBorder, palette.bgMain)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(palette.fieldBorder, palette.cardSurfacePrimary)).toBeGreaterThanOrEqual(3);
    });

    test("primary and secondary text reach 4.5:1 on the page", () => {
      expect(contrastRatio(palette.textPrimary, palette.bgMain)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.textSecondary, palette.bgMain)).toBeGreaterThanOrEqual(4.5);
    });

    test("secondary text reaches 4.5:1 on the field fill", () => {
      expect(contrastRatio(palette.textSecondary, palette.cardSurfacePrimary)).toBeGreaterThanOrEqual(4.5);
    });

    test("user bubble text reaches 4.5:1 on the bubble", () => {
      expect(contrastRatio(palette.userBubbleText, palette.userBubble)).toBeGreaterThanOrEqual(4.5);
    });
  });
}
