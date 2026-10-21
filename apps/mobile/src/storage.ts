import AsyncStorage from "@react-native-async-storage/async-storage";

export type Identity = {
  readonly sessionId: string;
  readonly username: string;
  readonly apiUrl: string;
};

const STORAGE_KEY = "mots.identity.v1";
const SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/;

function isIdentity(value: unknown): value is Identity {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.sessionId === "string" &&
    SESSION_ID.test(candidate.sessionId) &&
    typeof candidate.username === "string" &&
    candidate.username.trim().length > 0 &&
    typeof candidate.apiUrl === "string" &&
    candidate.apiUrl.trim().length > 0
  );
}

export async function loadIdentity(): Promise<Identity | undefined> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) return undefined;
    const value: unknown = JSON.parse(raw);
    return isIdentity(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export async function saveIdentity(identity: Identity): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
}

export async function clearIdentity(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
