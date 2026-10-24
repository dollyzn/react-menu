import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Opening hours: with `schedule_enabled` the store opens and closes by
 * itself following `opening_hours` (a week of intervals, business
 * timezone); `closed_until` is "close now" until the next opening.
 */
export default class extends BaseSchema {
  protected tableName = 'stores'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('schedule_enabled').notNullable().defaultTo(false)
      table.jsonb('opening_hours').notNullable().defaultTo('[]')
      table.timestamp('closed_until', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumns('schedule_enabled', 'opening_hours', 'closed_until')
    })
  }
}
