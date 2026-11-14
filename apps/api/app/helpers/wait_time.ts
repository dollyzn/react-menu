/**
 * "30 segundos", "5 minutos": how long until a rate limit lets the user try
 * again. Never zero or negative: the in-memory limiter reports a block that
 * already ended (but wasn't swept yet) with a negative time.
 */
export function waitTime(seconds: number) {
  const s = Math.max(1, Math.ceil(seconds))
  if (s <= 60) return s === 1 ? '1 segundo' : `${s} segundos`
  const minutes = Math.ceil(s / 60)
  return minutes === 1 ? '1 minuto' : `${minutes} minutos`
}
