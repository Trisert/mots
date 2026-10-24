import { Platform } from "react-native";
import { normalizeBaseUrl } from "./url";

export { normalizeBaseUrl };

const fallback = Platform.OS === "android" ? "http://10.0.2.2:8787" : "http://localhost:8787";

export const DEFAULT_API_URL = normalizeBaseUrl(process.env.EXPO_PUBLIC_MOTS_API_URL ?? fallback);
