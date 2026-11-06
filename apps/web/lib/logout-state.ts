import { useSyncExternalStore } from "react";

/**
 * Whether a sign-out is still running (API call, cookie, push, stored state).
 * The login page waits for it: a sign-in that lands meanwhile would be undone
 * by the sign-out's last steps (the stored session is purged at the end).
 */
let running = false;
const listeners = new Set<() => void>();

function set(value: boolean) {
  running = value;
  listeners.forEach((listener) => listener());
}

export const startLogout = () => set(true);
export const endLogout = () => set(false);

export function useLoggingOut() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => running,
    () => false
  );
}
