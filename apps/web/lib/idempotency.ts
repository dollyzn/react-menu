/**
 * Idempotency keys for writes (see the API's IdempotencyMiddleware).
 *
 * Every mutation gets a fresh key that is reused by its automatic retries.
 * Orders need more: if the response is lost and the customer taps again, or
 * reopens the app, the new attempt must reuse the key, so
 * `stableIdempotencyKey` keeps it on the device while the payload is the same.
 */

export const IDEMPOTENCY_HEADER = "Idempotency-Key";

const STORAGE_PREFIX = "idempotency:";
/** Older than this, an unfinished attempt is considered abandoned. */
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

type StoredKey = { key: string; fingerprint: string; at: number };

/** crypto.randomUUID needs a secure context; LAN http (testing on a phone) has none. */
export function randomId(): string {
  if (typeof window !== "undefined" && window.isSecureContext && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const memory = new Map<string, StoredKey>();

function read(scope: string): StoredKey | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + scope);
    return raw ? (JSON.parse(raw) as StoredKey) : null;
  } catch {
    return memory.get(scope) ?? null;
  }
}

function write(scope: string, value: StoredKey) {
  memory.set(scope, value);
  try {
    localStorage.setItem(STORAGE_PREFIX + scope, JSON.stringify(value));
  } catch {
    // Private mode / blocked storage: the in-memory copy covers this visit.
  }
}

/**
 * Same key for the same payload until `releaseIdempotencyKey` (after
 * success). A different payload is a different operation: new key.
 */
export function stableIdempotencyKey(scope: string, payload: unknown): string {
  const fingerprint = JSON.stringify(payload);
  const stored = read(scope);
  if (stored && stored.fingerprint === fingerprint && Date.now() - stored.at < MAX_AGE_MS) {
    return stored.key;
  }
  const fresh = { key: randomId(), fingerprint, at: Date.now() };
  write(scope, fresh);
  return fresh.key;
}

export function releaseIdempotencyKey(scope: string) {
  memory.delete(scope);
  try {
    localStorage.removeItem(STORAGE_PREFIX + scope);
  } catch {
    // Nothing stored.
  }
}
