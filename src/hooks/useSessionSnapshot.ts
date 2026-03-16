import { useSyncExternalStore } from "react";

interface SubscribableSession<T> {
  getSnapshot: () => T;
  onChange: ((snap: T) => void) | null;
}

export function useSessionSnapshot<T>(
  session: SubscribableSession<T> | null,
): T | null {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (!session) return () => {};
      session.onChange = () => onStoreChange();
      return () => {
        session.onChange = null;
      };
    },
    () => (session ? session.getSnapshot() : null),
  );
}
