import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * A partner's people (ADR 0024) have a role inside the partner: the
 * partner's manager sees the commission; an attendant only sells and
 * follows the orders. People already partners become its managers.
 * Written out here (not from the enum), so it doesn't depend on when this runs.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('store_user', (table) => {
      table.string('partner_role', 20).nullable()
    })
    // In order: the people already partners first, then the rule.
    this.defer(async (db) => {
      await db.rawQuery(`update store_user set partner_role = 'manager' where role = 'partner'`)
      await db.rawQuery(
        `ALTER TABLE store_user ADD CONSTRAINT store_user_partner_role_check CHECK (
          (role = 'partner' AND partner_role IN ('manager', 'attendant'))
          OR (role <> 'partner' AND partner_role IS NULL)
        )`
      )
    })
  }

  async down() {
    this.schema.raw(
      'ALTER TABLE store_user DROP CONSTRAINT IF EXISTS store_user_partner_role_check'
    )
    this.schema.alterTable('store_user', (table) => {
      table.dropColumn('partner_role')
    })
  }
}
