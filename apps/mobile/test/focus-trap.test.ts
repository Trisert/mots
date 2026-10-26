import { describe, expect, test } from "bun:test";
import { isEnabledElement, tabTrapIndex } from "../src/focus-trap.ts";

describe("tabTrapIndex", () => {
  test("wraps forward Tab from the last element to the first", () => {
    expect(tabTrapIndex({ count: 3, index: 2, shift: false, inside: true })).toBe(0);
  });

  test("wraps Shift+Tab from the first element to the last", () => {
    expect(tabTrapIndex({ count: 3, index: 0, shift: true, inside: true })).toBe(2);
  });

  test("lets the browser handle Tab between inner elements", () => {
    expect(tabTrapIndex({ count: 3, index: 1, shift: false, inside: true })).toBeUndefined();
    expect(tabTrapIndex({ count: 3, index: 1, shift: true, inside: true })).toBeUndefined();
  });

  test("pulls focus back in when it has escaped the panel", () => {
    expect(tabTrapIndex({ count: 3, index: -1, shift: false, inside: false })).toBe(0);
    expect(tabTrapIndex({ count: 3, index: -1, shift: true, inside: false })).toBe(2);
  });

  test("reports nothing to focus when the panel has no focusable elements", () => {
    expect(tabTrapIndex({ count: 0, index: -1, shift: false, inside: true })).toBe(-1);
  });
});

describe("isEnabledElement", () => {
  const element = (attrs: Record<string, string>) => ({
    hasAttribute: (name: string) => name in attrs,
    getAttribute: (name: string) => attrs[name] ?? null,
  });

  test("skips disabled and aria-disabled elements", () => {
    expect(isEnabledElement(element({}))).toBe(true);
    expect(isEnabledElement(element({ disabled: "" }))).toBe(false);
    expect(isEnabledElement(element({ "aria-disabled": "true" }))).toBe(false);
    expect(isEnabledElement(element({ "aria-disabled": "false" }))).toBe(true);
  });
});
