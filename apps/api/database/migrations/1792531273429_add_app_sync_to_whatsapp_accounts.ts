import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Coexistence (a number also used in the WhatsApp Business app): Meta asks
 * for its contacts and its chat history to be synced once, within 24 hours
 * of the onboarding. Each step's request id (or why it failed) is kept here.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('whatsapp_accounts', (table) => {
      table.jsonb('app_sync').notNullable().defaultTo('{}')
    })
  }

  async down() {
    this.schema.alterTable('whatsapp_accounts', (table) => table.dropColumn('app_sync'))
  }
}
