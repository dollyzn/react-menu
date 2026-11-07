import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * What each person wants to receive, beyond the bell (which always records
 * everything): push and e-mail per notification type (`channels`, only the
 * choices that differ from the defaults), stores muted entirely, and the
 * daily summary e-mail for the stores they manage.
 */
export default class extends BaseSchema {
  protected tableName = 'notification_preferences'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .uuid('user_id')
        .notNullable()
        .unique()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.jsonb('channels').notNullable().defaultTo('{}')
      table.jsonb('muted_store_ids').notNullable().defaultTo('[]')
      table.boolean('daily_summary').notNullable().defaultTo(false)
      /** Hour of the day (0-23, business timezone) it goes out. */
      table.smallint('daily_summary_hour').notNullable().defaultTo(8)
      /** Business date of the last summary sent (never twice a day). */
      table.date('daily_summary_sent_on').nullable()
      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
