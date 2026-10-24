import { describe, expect, test } from "bun:test";
import {
  classifyNotificationPermission,
  decidePushRegistration,
  isRegisterablePushToken,
  parseRememberedPush,
  pushNoticeCopy,
} from "../src/push.ts";

const TOKEN = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

describe("isRegisterablePushToken", () => {
  test("accepts the Expo token shapes the server stores", () => {
    expect(isRegisterablePushToken("ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]")).toBe(true);
    expect(isRegisterablePushToken("ExpoPushToken[abc]")).toBe(true);
    expect(isRegisterablePushToken("5fa729c6-e535-4b56-8f18-fdabd35785fc")).toBe(true);
  });

  test("rejects a token that would close the socket", () => {
    expect(isRegisterablePushToken("")).toBe(false);
    expect(isRegisterablePushToken("not-a-token")).toBe(false);
    expect(isRegisterablePushToken("ExpoPushToken[abc def]")).toBe(false);
    expect(isRegisterablePushToken("ExpoPushToken[]")).toBe(false);
    expect(isRegisterablePushToken(`ExpoPushToken[${"a".repeat(300)}]`)).toBe(false);
  });
});

describe("classifyNotificationPermission", () => {
  test("reads the three permission states", () => {
    expect(classifyNotificationPermission({ status: "granted", granted: true })).toBe("granted");
    expect(classifyNotificationPermission({ status: "undetermined", granted: false })).toBe(
      "undetermined",
    );
    expect(classifyNotificationPermission({ status: "denied", granted: false })).toBe("denied");
  });

  test("treats a revoked alert or a silenced Android channel as denied", () => {
    expect(
      classifyNotificationPermission({
        status: "granted",
        granted: true,
        ios: { status: 1, allowsAlert: false },
      }),
    ).toBe("denied");
    expect(
      classifyNotificationPermission({
        status: "granted",
        granted: true,
        ios: { status: 2, allowsAlert: false },
      }),
    ).toBe("denied");
    expect(
      classifyNotificationPermission({
        status: "granted",
        granted: true,
        android: { importance: 2 },
      }),
    ).toBe("denied");
  });
});

describe("decidePushRegistration", () => {
  test("asks until permission is granted, then registers on connect", () => {
    expect(
      decidePushRegistration({
        native: true,
        connected: true,
        permission: "undetermined",
        token: undefined,
        remembered: false,
        leaving: false,
      }),
    ).toEqual({ kind: "ask" });

    expect(
      decidePushRegistration({
        native: true,
        connected: true,
        permission: "granted",
        token: TOKEN,
        remembered: false,
        leaving: false,
      }),
    ).toEqual({ kind: "register", token: TOKEN });
  });

  test("does not register before the socket is up or on the web preview", () => {
    expect(
      decidePushRegistration({
        native: true,
        connected: false,
        permission: "granted",
        token: TOKEN,
        remembered: false,
        leaving: false,
      }).kind,
    ).toBe("idle");
    expect(
      decidePushRegistration({
        native: false,
        connected: true,
        permission: "granted",
        token: TOKEN,
        remembered: true,
        leaving: true,
      }).kind,
    ).toBe("idle");
  });

  test("clears when this phone leaves or its permission is revoked", () => {
    expect(
      decidePushRegistration({
        native: true,
        connected: true,
        permission: "granted",
        token: TOKEN,
        remembered: false,
        leaving: true,
      }),
    ).toEqual({ kind: "clear" });
    expect(
      decidePushRegistration({
        native: true,
        connected: true,
        permission: "denied",
        token: undefined,
        remembered: true,
        leaving: false,
      }),
    ).toEqual({ kind: "clear" });
  });

  test("does not clear a token this phone never stored", () => {
    expect(
      decidePushRegistration({
        native: true,
        connected: true,
        permission: "denied",
        token: undefined,
        remembered: false,
        leaving: false,
      }),
    ).toEqual({ kind: "denied" });
    expect(
      decidePushRegistration({
        native: true,
        connected: false,
        permission: "granted",
        token: TOKEN,
        remembered: true,
        leaving: true,
      }).kind,
    ).toBe("idle");
  });

  test("reports a granted phone that produced no Expo token", () => {
    expect(
      decidePushRegistration({
        native: true,
        connected: true,
        permission: "granted",
        token: "not-a-token",
        remembered: false,
        leaving: false,
      }),
    ).toEqual({ kind: "unavailable" });
  });
});

describe("push notices", () => {
  test("asks in Italian and offers to enable notifications", () => {
    expect(pushNoticeCopy("ask")).toEqual({
      message: "I promemoria arrivano anche con l'app chiusa.",
      actionLabel: "Attiva",
    });
    expect(pushNoticeCopy("denied").message).toContain("disattivate");
    expect(pushNoticeCopy("unavailable").actionLabel).toBeUndefined();
  });
});

describe("parseRememberedPush", () => {
  test("keeps the session this phone registered", () => {
    expect(parseRememberedPush({ sessionId: "session-1" })).toEqual({ sessionId: "session-1" });
  });

  test("drops a stored value that is not a session id", () => {
    expect(parseRememberedPush({ sessionId: "has spaces" })).toBeUndefined();
    expect(parseRememberedPush({ sessionId: "" })).toBeUndefined();
    expect(parseRememberedPush(null)).toBeUndefined();
  });
});
