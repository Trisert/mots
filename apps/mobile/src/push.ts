/**
 * What the phone should do with the session's one Expo push token.
 * The wire format matches `requirePushToken` in `@mots/protocol`.
 * An invalid token is never handed to the socket: the server closes on it.
 */

const EXPO_PUSH_TOKEN_PATTERN = /^(?:ExponentPushToken|ExpoPushToken)\[[^\s\[\]]+\]$/;
const LEGACY_EXPO_PUSH_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PUSH_TOKEN_CHARACTERS = 256;

/** UNAuthorizationStatus.denied */
const IOS_AUTHORIZATION_DENIED = 1;
/** UNAuthorizationStatus.notDetermined */
const IOS_AUTHORIZATION_NOT_DETERMINED = 0;
/** UNAuthorizationStatus.provisional */
const IOS_AUTHORIZATION_PROVISIONAL = 3;
/** NotificationManager.IMPORTANCE_NONE */
const ANDROID_IMPORTANCE_NONE = 2;

export type PushPermission = "granted" | "denied" | "undetermined";

export type PushPhase =
  | { readonly kind: "ask" }
  | { readonly kind: "register"; readonly token: string }
  | { readonly kind: "clear" }
  | { readonly kind: "denied" }
  | { readonly kind: "unavailable" }
  | { readonly kind: "idle" };

export type RememberedPush = {
  readonly sessionId: string;
};

export type PushNoticeCopy = {
  readonly message: string;
  readonly actionLabel?: string;
};

export function isRegisterablePushToken(value: string): boolean {
  if (value.length === 0 || value.length > MAX_PUSH_TOKEN_CHARACTERS) return false;
  return EXPO_PUSH_TOKEN_PATTERN.test(value) || LEGACY_EXPO_PUSH_TOKEN_PATTERN.test(value);
}

export function classifyNotificationPermission(settings: {
  readonly status: string;
  readonly granted: boolean;
  readonly ios?: {
    readonly status?: number;
    readonly allowsAlert?: boolean | null;
  };
  readonly android?: { readonly importance?: number };
}): PushPermission {
  if (settings.status === "denied" || settings.ios?.status === IOS_AUTHORIZATION_DENIED) {
    return "denied";
  }
  if (settings.android?.importance === ANDROID_IMPORTANCE_NONE) return "denied";
  const iosStatus = settings.ios?.status;
  if (
    settings.ios?.allowsAlert === false &&
    iosStatus !== undefined &&
    iosStatus !== IOS_AUTHORIZATION_NOT_DETERMINED &&
    iosStatus !== IOS_AUTHORIZATION_PROVISIONAL
  ) {
    return "denied";
  }
  if (settings.granted || settings.status === "granted") return "granted";
  return "undetermined";
}

export function parseRememberedPush(value: unknown): RememberedPush | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.sessionId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(record.sessionId)) {
    return undefined;
  }
  return { sessionId: record.sessionId };
}

/**
 * Register only while this phone is connected and allowed to notify.
 * Clear when it leaves, or when permission is gone and this phone had registered.
 * Web never registers, so it does not clear a token another device stored.
 */
export function decidePushRegistration(input: {
  readonly native: boolean;
  readonly connected: boolean;
  readonly permission: PushPermission;
  readonly token: string | undefined;
  readonly remembered: boolean;
  readonly leaving: boolean;
}): PushPhase {
  if (!input.native) return { kind: "idle" };
  if (input.leaving) return input.connected ? { kind: "clear" } : { kind: "idle" };
  if (!input.connected) return { kind: "idle" };
  if (input.permission === "undetermined") return { kind: "ask" };
  if (input.permission === "denied") {
    return input.remembered ? { kind: "clear" } : { kind: "denied" };
  }
  if (input.token !== undefined && isRegisterablePushToken(input.token)) {
    return { kind: "register", token: input.token };
  }
  return { kind: "unavailable" };
}

export function pushNoticeCopy(kind: "ask" | "denied" | "unavailable"): PushNoticeCopy {
  switch (kind) {
    case "ask":
      return {
        message: "I promemoria arrivano anche con l'app chiusa.",
        actionLabel: "Attiva",
      };
    case "denied":
      return {
        message: "Le notifiche sono disattivate. I promemoria restano in questa chat.",
      };
    case "unavailable":
      return {
        message: "Non riesco a registrare questo telefono per i promemoria.",
      };
  }
}
