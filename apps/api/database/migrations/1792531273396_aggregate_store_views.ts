import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Menu visits counted per store, hour and platform instead of one row per
 * visit (the old store_views table grew with every page load). Existing
 * visits are folded into the new table.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('store_view_counts', (table) => {
      table.uuid('store_id').notNullable().references('id').inTable('stores').onDelete('CASCADE')
      table.timestamp('hour').notNullable()
      table.enum('platform', ['mobile', 'desktop']).notNullable()
      table.integer('count').notNullable().defaultTo(0)
      table.primary(['store_id', 'hour', 'platform'])
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        insert into store_view_counts (store_id, hour, platform, count)
        select store_id, date_trunc('hour', created_at), platform, count(*)
        from store_views
        group by store_id, date_trunc('hour', created_at), platform
      `)
    })
    this.schema.dropTable('store_views')
  }

  async down() {
    this.schema.createTable('store_views', (table) => {
      table.increments('id')
      table.uuid('store_id').notNullable().references('id').inTable('stores').onDelete('CASCADE')
      table.enum('platform', ['mobile', 'desktop']).notNullable().defaultTo('desktop')
      table.timestamps(true, true)
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        insert into store_views (store_id, platform, created_at, updated_at)
        select store_id, platform, hour, hour
        from store_view_counts, generate_series(1, count)
      `)
    })
    this.schema.dropTable('store_view_counts')
  }
}
