import { describe, expect, test } from "bun:test";
import { parseSessionCapability, SESSION_CAPABILITY_PATTERN } from "../src/session-capability.ts";

const UUID = "8f0fecb4-c963-4b91-9c96-61dca6441d53";
const SIGNATURE = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMnopq";

describe("parseSessionCapability", () => {
  test("accepts a uuid and a 43-character signature", () => {
    expect(SIGNATURE.length).toBe(43);
    const capability = `${UUID}_${SIGNATURE}`;
    expect(SESSION_CAPABILITY_PATTERN.test(capability)).toBe(true);
    expect(parseSessionCapability(capability)).toEqual({
      sessionId: UUID,
      signature: SIGNATURE,
    });
    expect(capability.length).toBeLessThanOrEqual(128);
  });

  test("rejects a bare uuid, a short signature, and an uppercase uuid", () => {
    expect(parseSessionCapability(UUID)).toBeUndefined();
    expect(parseSessionCapability(`${UUID}_${SIGNATURE.slice(0, 42)}`)).toBeUndefined();
    expect(parseSessionCapability(`${UUID.toUpperCase()}_${SIGNATURE}`)).toBeUndefined();
    expect(parseSessionCapability(`${UUID}.${SIGNATURE}`)).toBeUndefined();
  });
});
