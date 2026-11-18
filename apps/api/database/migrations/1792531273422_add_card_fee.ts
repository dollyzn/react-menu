import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Card fee passed on to the customer in the online checkout: a percentage
 * per card type, set by the store. The fee is charged on top of the order
 * and kept apart from it, on the attempt and on the receipt it paid, so
 * what was paid still adds up to the order's total.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('stores', (table) => {
      table.boolean('card_fee_enabled').notNullable().defaultTo(false)
      table.decimal('card_credit_fee_percent', 5, 2).notNullable().defaultTo(0)
      table.decimal('card_debit_fee_percent', 5, 2).notNullable().defaultTo(0)
    })
    this.schema.alterTable('payments', (table) => {
      table.decimal('fee', 10, 2).notNullable().defaultTo(0)
    })
    this.schema.alterTable('order_receipts', (table) => {
      table.decimal('fee', 10, 2).notNullable().defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable('order_receipts', (table) => {
      table.dropColumn('fee')
    })
    this.schema.alterTable('payments', (table) => {
      table.dropColumn('fee')
    })
    this.schema.alterTable('stores', (table) => {
      table.dropColumn('card_debit_fee_percent')
      table.dropColumn('card_credit_fee_percent')
      table.dropColumn('card_fee_enabled')
    })
  }
}
