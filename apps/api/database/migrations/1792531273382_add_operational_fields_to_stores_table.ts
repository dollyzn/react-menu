import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'stores'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('phone').nullable()
      table.text('description').nullable()
      /** Average minutes from order to pickup, shown to customers. */
      table.integer('pickup_eta_minutes').notNullable().defaultTo(20)
      /** When false, stock is not tracked and never makes items unavailable. */
      table.boolean('inventory_enabled').notNullable().defaultTo(false)
      table.boolean('counter_payment_enabled').notNullable().defaultTo(true)
      /** Encrypted with APP_KEY; never serialized. */
      table.text('mercado_pago_access_token').nullable()
      table.text('mercado_pago_webhook_secret').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumns(
        'phone',
        'description',
        'pickup_eta_minutes',
        'inventory_enabled',
        'counter_payment_enabled',
        'mercado_pago_access_token',
        'mercado_pago_webhook_secret'
      )
    })
  }
}
