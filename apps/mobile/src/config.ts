import { Platform } from "react-native";

export function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (trimmed.length === 0) return trimmed;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

const fallback = Platform.OS === "android" ? "http://10.0.2.2:8787" : "http://localhost:8787";

export const DEFAULT_API_URL = normalizeBaseUrl(process.env.EXPO_PUBLIC_MOTS_API_URL ?? fallback);
