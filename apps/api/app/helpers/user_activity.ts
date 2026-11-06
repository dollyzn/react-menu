import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

/** The panel pings every minute while visible; a missed ping or two still reads as online. */
export const ONLINE_WINDOW_MS = 2.5 * 60_000

/** At most one write per user per this long, per process. */
const TOUCH_EVERY_MS = 60_000
const lastTouch = new Map<string, number>()

/**
 * Records that the panel is open ("online" on the team page): the panel's
 * heartbeat (GET /auth/presence, only while the tab is visible) and /auth/me.
 * Not every request: pages poll in background tabs. Throttled in memory, so
 * a burst costs one UPDATE a minute.
 */
export async function touchLastSeen(userId: string) {
  const now = Date.now()
  if (now - (lastTouch.get(userId) ?? 0) < TOUCH_EVERY_MS) return
  try {
    await db
      .from('users')
      .where('id', userId)
      .update({ last_seen_at: new Date(now) })
    if (lastTouch.size > 10_000) lastTouch.clear()
    lastTouch.set(userId, now)
  } catch (error) {
    // Best effort: "online" is never worth failing the request.
    logger.warn({ err: error }, 'could not record last_seen_at')
  }
}

/** The sessions ended: the next sign-in records activity right away. */
export function forgetLastSeen(userId: string) {
  lastTouch.delete(userId)
}

/** The person proved they read this inbox; the first proof is kept. */
export async function markEmailVerified(userId: string, trx?: TransactionClientContract) {
  await (trx ?? db)
    .from('users')
    .where('id', userId)
    .whereNull('email_verified_at')
    .update({ email_verified_at: new Date() })
}
