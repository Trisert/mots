import { useEffect, useMemo, useSyncExternalStore } from "react";
import { MotsClient } from "@mots/client";

export type MotsSessionOptions = {
  readonly baseUrl: string;
  readonly sessionId: string;
  readonly username: string;
};

export function useMotsSession(options: MotsSessionOptions) {
  const client = useMemo(
    () =>
      new MotsClient({
        baseUrl: options.baseUrl,
        sessionId: options.sessionId,
        username: options.username,
      }),
    [options.baseUrl, options.sessionId, options.username],
  );

  const subscribe = useMemo(
    () => (listener: () => void) => client.subscribe(listener),
    [client],
  );
  const getSnapshot = useMemo(() => () => client.getSnapshot(), [client]);
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    client.connect();
    return () => client.dispose();
  }, [client]);

  return { client, state };
}
