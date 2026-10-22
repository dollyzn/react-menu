import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The e-mail typed at the Pix/card step (receipt and refund notices go
 * there) and when the receipt went out, so it is sent once.
 */
export default class extends BaseSchema {
  protected tableName = 'payments'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('payer_email', 254).nullable()
      table.timestamp('receipt_sent_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumns('payer_email', 'receipt_sent_at')
    })
  }
}
