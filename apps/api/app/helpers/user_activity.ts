import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

/** The panel pings every minute while visible; a missed ping or two still reads as online. */
export const ONLINE_WINDOW_MS = 2.5 * 60_000

/** At most one write per user per this long, per process. */
const TOUCH_EVERY_MS = 60_000
const lastTouch = new Map<string, number>()

/**
 * Records authenticated activity ("online" on the team page). Throttled in
 * memory, so a burst of requests costs one UPDATE a minute.
 */
export async function touchLastSeen(userId: string) {
  const now = Date.now()
  if (now - (lastTouch.get(userId) ?? 0) < TOUCH_EVERY_MS) return
  lastTouch.set(userId, now)
  if (lastTouch.size > 10_000) lastTouch.clear()
  await db
    .from('users')
    .where('id', userId)
    .update({ last_seen_at: new Date(now) })
}

/** The person proved they read this inbox; the first proof is kept. */
export async function markEmailVerified(userId: string, trx?: TransactionClientContract) {
  await (trx ?? db)
    .from('users')
    .where('id', userId)
    .whereNull('email_verified_at')
    .update({ email_verified_at: new Date() })
}
