import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * When a WhatsApp Business app number (coexistence) went through Embedded
 * Signup: Meta's 24 hours to sync its contacts and history start there, and
 * the sync job belongs to that onboarding. Only `connect` with a signup code
 * sets it ("Atualizar" and `whatsapp:webhook` don't). Numbers connected
 * before it have none: their sync isn't tracked (nor shown).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('whatsapp_accounts', (table) => {
      table.timestamp('app_onboarded_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.alterTable('whatsapp_accounts', (table) => table.dropColumn('app_onboarded_at'))
  }
}
