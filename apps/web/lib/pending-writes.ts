import { useSyncExternalStore } from "react";

/**
 * Writes in flight (mutations, retries included). Leaving the page while one
 * is pending may leave it unconfirmed, so PendingWritesGuard holds navigation
 * until they finish. Background writes (mark as read, push registration)
 * opt out with `extraOptions: { background: true }`.
 */
let pending = 0;
const listeners = new Set<(count: number) => void>();

const notify = () => listeners.forEach((listener) => listener(pending));

export async function trackWrite<T>(operation: Promise<T>): Promise<T> {
  pending += 1;
  notify();
  try {
    return await operation;
  } finally {
    pending = Math.max(0, pending - 1);
    notify();
  }
}

export const getPendingWrites = () => pending;

export function subscribePendingWrites(listener: (count: number) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePendingWrites() {
  return useSyncExternalStore(subscribePendingWrites, getPendingWrites, () => 0);
}
