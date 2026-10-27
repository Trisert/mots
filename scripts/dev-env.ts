/**
 * Pure helpers for `bun run setup` and `bun run dev`. No file or network access here, so tests can
 * call them directly.
 */

/** Both secrets the Worker refuses to start sessions without. */
export const REQUIRED_SECRETS = ["MOTS_SESSION_SECRET", "MOTS_CREATE_TOKEN"] as const;

/** The Worker rejects shorter values. */
export const MIN_SECRET_LENGTH = 16;

const assignment = (name: string): RegExp => new RegExp(`^[ \\t]*${name}[ \\t]*=(.*)$`, "m");

/** The value of an uncommented `NAME=value` line, trimmed. */
export function readVar(text: string, name: string): string | undefined {
  const match = assignment(name).exec(text);
  return match?.[1]?.trim();
}

/**
 * Give every required secret that is missing, empty or too short a fresh random value. Values that
 * already work are kept, so rerunning setup never invalidates join codes.
 */
export function fillSecrets(
  text: string,
  random: () => string,
): { readonly text: string; readonly filled: readonly string[] } {
  let next = text;
  const filled: string[] = [];
  for (const name of REQUIRED_SECRETS) {
    const current = readVar(next, name);
    if (current !== undefined && current.length >= MIN_SECRET_LENGTH) continue;
    const line = `${name}=${random()}`;
    next = current === undefined
      ? `${next.replace(/\n*$/, "\n")}${line}\n`
      : next.replace(assignment(name), line);
    filled.push(name);
  }
  return { text: next, filled };
}

/** Set `name` in a dotenv file, replacing an existing line or appending one. */
export function setVar(text: string, name: string, value: string): string {
  const line = `${name}=${value}`;
  if (assignment(name).test(text)) return text.replace(assignment(name), line);
  return text.length === 0 ? `${line}\n` : `${text.replace(/\n*$/, "\n")}${line}\n`;
}

type NetworkInterface = {
  readonly address: string;
  readonly family: string | number;
  readonly internal: boolean;
};

const PRIVATE_IPV4 = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

/**
 * The address a phone on the same network can reach this computer at: the first private, external
 * IPv4 address. Virtual adapters (WSL, Docker, VPNs) often come first on Windows, so prefer 192.168
 * and 10. ranges, which home and office Wi-Fi use.
 */
export function lanAddress(
  interfaces: Readonly<Record<string, readonly NetworkInterface[] | undefined>>,
): string | undefined {
  const candidates = Object.values(interfaces)
    .flatMap((list) => list ?? [])
    .filter((entry) => !entry.internal && (entry.family === "IPv4" || entry.family === 4))
    .map((entry) => entry.address)
    .filter((address) => PRIVATE_IPV4.test(address));
  const rank = (address: string): number =>
    address.startsWith("192.168.") ? 0 : address.startsWith("10.") ? 1 : 2;
  return candidates.sort((a, b) => rank(a) - rank(b))[0];
}

/**
 * Where the app sends its requests. A server URL already in `EXPO_PUBLIC_MOTS_API_URL` wins: the
 * app then uses that server (a deployed Worker, for example) and no Worker starts on this computer.
 * A bare host is taken as https. Otherwise the app uses this computer's LAN address, so a phone on
 * the same Wi-Fi reaches the local Worker without typing anything.
 */
export function devServerPlan(input: {
  readonly remoteUrl?: string;
  readonly lan?: string;
  readonly port: number;
}): { readonly apiUrl?: string; readonly localWorker: boolean } {
  const remote = input.remoteUrl?.trim().replace(/\/+$/, "") ?? "";
  if (remote.length > 0) {
    return { apiUrl: /^https?:\/\//i.test(remote) ? remote : `https://${remote}`, localWorker: false };
  }
  if (input.lan === undefined) return { localWorker: true };
  return { apiUrl: `http://${input.lan}:${input.port}`, localWorker: true };
}
