import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import type { MotsClient } from "@mots/client";
import {
  classifyNotificationPermission,
  decidePushRegistration,
  isRegisterablePushToken,
  parseRememberedPush,
  pushNoticeCopy,
  type PushPermission,
  type RememberedPush,
} from "../push";

const STORAGE_KEY = "mots.push-token.v1";
const CHANNEL_ID = "default";

export type PushNotice = {
  readonly message: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly onDismiss: () => void;
};

type Options = {
  readonly client: MotsClient;
  readonly sessionId: string;
  readonly connected: boolean;
};

let handlerInstalled = false;

function installPushHandler(): void {
  if (handlerInstalled) return;
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;
  handlerInstalled = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    return;
  }
}

async function readRememberedPush(): Promise<RememberedPush | undefined> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) return undefined;
    return parseRememberedPush(JSON.parse(raw) as unknown);
  } catch {
    return undefined;
  }
}

async function rememberPush(value: RememberedPush): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    return;
  }
}

async function forgetPush(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}

async function readPushPermission(): Promise<PushPermission> {
  const settings = await Notifications.getPermissionsAsync();
  return classifyNotificationPermission(settings);
}

async function askPushPermission(): Promise<PushPermission> {
  const settings = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });
  return classifyNotificationPermission(settings);
}

async function readExpoPushToken(): Promise<string | undefined> {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: "Promemoria",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const token = await Notifications.getExpoPushTokenAsync();
    return isRegisterablePushToken(token.data) ? token.data : undefined;
  } catch {
    return undefined;
  }
}

export function usePushRegistration({ client, sessionId, connected }: Options): {
  readonly notice: PushNotice | undefined;
  readonly clearPushToken: () => void;
} {
  const native = Platform.OS === "ios" || Platform.OS === "android";
  const [noticeKind, setNoticeKind] = useState<"ask" | "denied" | "unavailable" | undefined>();
  const dismissed = useRef(new Set<string>());
  const remembered = useRef(false);
  const sentToken = useRef<string | undefined>(undefined);
  const generation = useRef(0);
  const asking = useRef(false);

  useEffect(() => {
    installPushHandler();
  }, []);

  useEffect(() => {
    remembered.current = false;
    sentToken.current = undefined;
  }, [sessionId]);

  useEffect(() => {
    if (!connected) sentToken.current = undefined;
  }, [connected]);

  const apply = useCallback(
    async (permission: PushPermission, token: string | undefined, current: number) => {
      const phase = decidePushRegistration({
        native,
        connected,
        permission,
        token,
        remembered: remembered.current,
        leaving: false,
      });
      if (current !== generation.current) return;
      if (phase.kind === "register") {
        if (sentToken.current === phase.token) {
          setNoticeKind(undefined);
          return;
        }
        if (!client.registerPushToken(phase.token)) return;
        sentToken.current = phase.token;
        remembered.current = true;
        await rememberPush({ sessionId });
        if (current !== generation.current) return;
        setNoticeKind(undefined);
        return;
      }
      if (phase.kind === "clear") {
        if (client.clearPushToken()) {
          sentToken.current = undefined;
          remembered.current = false;
          await forgetPush();
        }
        if (current !== generation.current) return;
        setNoticeKind(dismissed.current.has("denied") ? undefined : "denied");
        return;
      }
      if (phase.kind === "ask" || phase.kind === "denied" || phase.kind === "unavailable") {
        setNoticeKind(dismissed.current.has(phase.kind) ? undefined : phase.kind);
        return;
      }
      setNoticeKind(undefined);
    },
    [client, connected, native, sessionId],
  );

  const refresh = useCallback(async () => {
    if (!native || !connected) {
      setNoticeKind(undefined);
      return;
    }
    const current = ++generation.current;
    const stored = await readRememberedPush();
    if (current !== generation.current) return;
    if (stored?.sessionId === sessionId) remembered.current = true;
    const permission = await readPushPermission();
    if (current !== generation.current) return;
    const token = permission === "granted" ? await readExpoPushToken() : undefined;
    if (current !== generation.current) return;
    await apply(permission, token, current);
  }, [apply, connected, native, sessionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!native) return;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void refresh();
    });
    return () => subscription.remove();
  }, [native, refresh]);

  const requestPermission = useCallback(() => {
    if (asking.current || !native || !connected) return;
    asking.current = true;
    const current = ++generation.current;
    void (async () => {
      try {
        const permission = await askPushPermission();
        if (current !== generation.current) return;
        const token = permission === "granted" ? await readExpoPushToken() : undefined;
        if (current !== generation.current) return;
        await apply(permission, token, current);
      } finally {
        asking.current = false;
      }
    })();
  }, [apply, connected, native]);

  const dismiss = useCallback(() => {
    if (noticeKind !== undefined) dismissed.current.add(noticeKind);
    setNoticeKind(undefined);
  }, [noticeKind]);

  const clearPushToken = useCallback(() => {
    generation.current += 1;
    const phase = decidePushRegistration({
      native,
      connected,
      permission: "denied",
      token: undefined,
      remembered: remembered.current,
      leaving: true,
    });
    if (phase.kind !== "clear") return;
    if (!client.clearPushToken()) return;
    sentToken.current = undefined;
    remembered.current = false;
    void forgetPush();
  }, [client, connected, native]);

  if (noticeKind === undefined) return { notice: undefined, clearPushToken };
  const copy = pushNoticeCopy(noticeKind);
  return {
    notice: {
      message: copy.message,
      ...(copy.actionLabel === undefined
        ? {}
        : { actionLabel: copy.actionLabel, onAction: requestPermission }),
      onDismiss: dismiss,
    },
    clearPushToken,
  };
}
