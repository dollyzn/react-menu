import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Web push moved from raw VAPID subscriptions to Firebase Cloud Messaging,
 * addressed by Firebase Installation IDs (ADR 0008). The old table never held production data:
 * its endpoints did not exist before the switch.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.dropTable('push_subscriptions')

    this.schema.createTable('push_registrations', (table) => {
      table.increments('id')
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('fid').notNullable().unique()
      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable('push_registrations')

    this.schema.createTable('push_subscriptions', (table) => {
      table.increments('id')
      table.uuid('user_id').notNullable().references('users.id').onDelete('CASCADE')
      table.text('endpoint').notNullable().unique()
      table.text('p256dh').notNullable()
      table.text('auth').notNullable()
      table.timestamps(true, true)
    })
  }
}
