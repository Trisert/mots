import { Platform } from "react-native";

export function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (trimmed.length === 0) return trimmed;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

const fallback = Platform.OS === "android" ? "http://10.0.2.2:8787" : "http://localhost:8787";

const REPLIT_API_PORT = 8080;

function replitWebApiUrl(): string | undefined {
  if (Platform.OS !== "web" || typeof window === "undefined") return undefined;
  const { hostname, protocol } = window.location;
  if (!hostname.endsWith(".replit.dev") && !hostname.endsWith(".repl.co")) return undefined;
  return `${protocol}//${hostname}:${REPLIT_API_PORT}`;
}

export const DEFAULT_API_URL = normalizeBaseUrl(
  process.env.EXPO_PUBLIC_MOTS_API_URL ?? replitWebApiUrl() ?? fallback,
);
