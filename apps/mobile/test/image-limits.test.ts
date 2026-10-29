import { describe, expect, test } from "bun:test";
import { MAX_IMAGE_BASE64_CHARACTERS } from "@mots/protocol";
import { fitsImageLimit, resizeTarget } from "../src/image-limits";

describe("resizeTarget", () => {
  test("shrinks the longer edge and keeps the aspect ratio", () => {
    expect(resizeTarget(4000, 3000, 1024)).toEqual({ width: 1024 });
    expect(resizeTarget(3000, 4000, 1024)).toEqual({ height: 1024 });
  });

  test("never enlarges a picture that is already small", () => {
    expect(resizeTarget(800, 600, 1024)).toBeUndefined();
  });

  test("ignores a picture without a usable size", () => {
    expect(resizeTarget(0, 600, 1024)).toBeUndefined();
    expect(resizeTarget(Number.NaN, 600, 1024)).toBeUndefined();
  });
});

describe("fitsImageLimit", () => {
  test("accepts up to the server limit and refuses more or nothing", () => {
    expect(fitsImageLimit("a".repeat(MAX_IMAGE_BASE64_CHARACTERS))).toBe(true);
    expect(fitsImageLimit("a".repeat(MAX_IMAGE_BASE64_CHARACTERS + 1))).toBe(false);
    expect(fitsImageLimit("")).toBe(false);
  });
});
