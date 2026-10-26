import { Platform } from "react-native";
import { defaultApiUrl, normalizeBaseUrl } from "./url";

export { normalizeBaseUrl };

export const DEFAULT_API_URL = defaultApiUrl({
  envUrl: process.env.EXPO_PUBLIC_MOTS_API_URL,
  os: Platform.OS,
  webHost: typeof window === "undefined" ? undefined : window.location?.hostname,
});
