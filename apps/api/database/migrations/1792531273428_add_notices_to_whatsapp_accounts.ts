import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Which order notices a store sends (ADR 0025): received, preparing, ready,
 * completed, cancelled. Only the choices that differ from each notice's
 * default are kept (`NOTICES` in app/whatsapp/templates.ts).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('whatsapp_accounts', (table) => {
      table.jsonb('notices').notNullable().defaultTo('{}')
    })
  }

  async down() {
    this.schema.alterTable('whatsapp_accounts', (table) => table.dropColumn('notices'))
  }
}
