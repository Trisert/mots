import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { MotsClient } from "@mots/client";

/** The device's IANA timezone, or undefined when the runtime does not report one. */
const deviceTimezone = (): string | undefined => {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof timezone === "string" && timezone.length > 0 ? timezone : undefined;
  } catch {
    return undefined;
  }
};

export type MotsSessionOptions = {
  readonly baseUrl: string;
  readonly sessionId: string;
  readonly username: string;
  /** When false, the socket stays down. Used while a join code is still being checked. */
  readonly enabled?: boolean;
};

export function useMotsSession(options: MotsSessionOptions) {
  // A terminal close sets a private flag on MotsClient and later connect() calls do nothing.
  // A new client is the reset available without changing the client package.
  const [epoch, setEpoch] = useState(0);
  const retry = useCallback(() => setEpoch((current) => current + 1), []);
  const client = useMemo(
    () =>
      new MotsClient({
        baseUrl: options.baseUrl,
        sessionId: options.sessionId,
        username: options.username,
        timezone: deviceTimezone(),
      }),
    [epoch, options.baseUrl, options.enabled, options.sessionId, options.username],
  );

  const subscribe = useMemo(
    () => (listener: () => void) => client.subscribe(listener),
    [client],
  );
  const getSnapshot = useMemo(() => () => client.getSnapshot(), [client]);
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (options.enabled === false) return;
    client.connect();
    return () => client.dispose();
  }, [client, options.enabled]);

  return { client, state, retry };
}
