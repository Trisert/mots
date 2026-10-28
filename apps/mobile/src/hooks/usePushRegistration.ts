import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { MotsClient } from "@mots/client";

/** The Android channel that reminder and routine pushes arrive on. Expo sends them to "default". */
const ANDROID_CHANNEL_ID = "default";

/**
 * Ask for notification permission, read the Expo push token, and hand it to the session.
 * Runs once per client. Expo Go and web have no native push, so they stay silent.
 */
export function usePushRegistration(client: MotsClient, enabled: boolean, channelName: string): void {
  useEffect(() => {
    if (!enabled || Platform.OS !== "android") return;
    let alive = true;
    void registerForPush(channelName)
      .then((token) => {
        if (alive && token !== undefined) client.setPushToken(token);
      })
      .catch(() => {
        // No token means no push. The chat still works; the app shows nothing new.
      });
    return () => {
      alive = false;
    };
  }, [client, enabled, channelName]);
}

async function registerForPush(channelName: string): Promise<string | undefined> {
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: channelName,
    importance: Notifications.AndroidImportance.HIGH,
  });
  const current = await Notifications.getPermissionsAsync();
  const status =
    current.status === "granted"
      ? current.status
      : (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return undefined;
  const { data } = await Notifications.getExpoPushTokenAsync();
  return data;
}
