import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * users.email_verified_at for people who proved their address before the
 * column existed: an e-mail sign-in code they used, or a reset/invite link
 * they followed (the earliest of them).
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE users u SET email_verified_at = proof.at
        FROM (
          SELECT user_id, min(at) AS at FROM (
            SELECT user_id, consumed_at AS at FROM login_challenges
              WHERE method = 'email' AND consumed_at IS NOT NULL
            UNION ALL
            SELECT user_id, used_at AS at FROM password_reset_tokens WHERE used_at IS NOT NULL
          ) proofs GROUP BY user_id
        ) proof
        WHERE proof.user_id = u.id AND u.email_verified_at IS NULL
      `)
    })
  }

  async down() {
    // Nothing to undo: the column itself goes with its own migration.
  }
}
