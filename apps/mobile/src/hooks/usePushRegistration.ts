import { useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import type { MotsClient } from "@mots/client";

/** The Android channel that reminder and routine pushes arrive on. Expo sends them to "default". */
const ANDROID_CHANNEL_ID = "default";

/**
 * Ask for notification permission, read the Expo push token, and hand it to the session.
 * Runs once per client. Expo Go and web have no native push, so they stay silent.
 */
export function usePushRegistration(client: MotsClient, enabled: boolean, channelName: string): void {
  // The channel name follows the app language. Only this effect depends on it, so a language
  // change does not register the push token again.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    void Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: channelName,
      importance: Notifications.AndroidImportance.HIGH,
    }).catch((error: unknown) => {
      console.warn("Notification channel setup failed", error);
    });
  }, [channelName]);

  useEffect(() => {
    if (!enabled || Platform.OS !== "android") return;
    let alive = true;
    void registerForPush()
      .then((token) => {
        if (alive && token !== undefined) client.setPushToken(token);
      })
      .catch((error: unknown) => {
        // Without a token the app gets no push. Log the reason so a missing Firebase setup is visible.
        console.warn("Push registration failed", error);
      });
    return () => {
      alive = false;
    };
  }, [client, enabled]);
}

async function registerForPush(): Promise<string | undefined> {
  // Show reminders while the app is open too. Without a handler, Expo drops foreground banners.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  const current = await Notifications.getPermissionsAsync();
  const status =
    current.status === "granted"
      ? current.status
      : (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return undefined;
  // The EAS project id from app.json. Expo issues the token for this project only.
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (typeof projectId !== "string" || projectId.length === 0) return undefined;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}
