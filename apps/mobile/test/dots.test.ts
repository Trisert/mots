import { describe, expect, test } from "bun:test";
import { DOT_COLS, DOT_ROWS, DOTS } from "../src/dots.ts";

describe("dot mascot", () => {
  test("is a compact face with two blinking dots and one wave", () => {
    expect(DOTS.length).toBeGreaterThan(8);
    expect(DOTS.filter((dot) => dot.role === "eye")).toHaveLength(2);
    expect(DOTS.filter((dot) => dot.role === "wave")).toHaveLength(1);
    const keys = new Set(DOTS.map((dot) => `${dot.col},${dot.row}`));
    expect(keys.size).toBe(DOTS.length);
    for (const dot of DOTS) {
      expect(dot.col).toBeGreaterThanOrEqual(0);
      expect(dot.col).toBeLessThan(DOT_COLS);
      expect(dot.row).toBeGreaterThanOrEqual(0);
      expect(dot.row).toBeLessThan(DOT_ROWS);
    }
  });
});
