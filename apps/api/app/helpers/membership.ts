import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * A store the person can work in: a store_user row their managers haven't
 * switched off (`disabled_at`). Every membership check goes through this
 * rule (or `User.activeStores`, which applies it to the relation).
 */
export async function hasActiveStore(userId: string, client?: TransactionClientContract) {
  const row = await (client ?? db)
    .from('store_user')
    .where('user_id', userId)
    .whereNull('disabled_at')
    .first()
  return Boolean(row)
}
