import { describe, expect, test } from "bun:test";
import {
  configuredSecret,
  issueSessionCapability,
  secretsMatch,
  signSessionId,
  verifySessionCapability,
} from "../src/session-auth.ts";

const SECRET = "test-session-secret-0123456789";

describe("session capabilities", () => {
  test("rejects short secrets and accepts a matching bearer secret", () => {
    expect(configuredSecret("short")).toBeUndefined();
    expect(configuredSecret(`  ${SECRET}  `)).toBe(SECRET);
    expect(secretsMatch(SECRET, SECRET)).toBe(true);
    expect(secretsMatch(SECRET, `${SECRET}x`)).toBe(false);
    expect(secretsMatch(SECRET, SECRET.slice(0, -1))).toBe(false);
  });

  test("round-trips a join code and rejects a signature signed with another secret", async () => {
    const issued = await issueSessionCapability(SECRET);
    expect(await verifySessionCapability(SECRET, issued.capability)).toBe(issued.sessionId);
    expect(issued.capability.startsWith(`${issued.sessionId}_`)).toBe(true);
    expect((await signSessionId(SECRET, issued.sessionId)).length).toBe(43);
    expect(await verifySessionCapability(`${SECRET}-other-key`, issued.capability)).toBeUndefined();
    expect(await verifySessionCapability(SECRET, issued.sessionId)).toBeUndefined();
  });
});
