import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Mercado Pago Point (ADR 0020): the store's card machines charged from the
 * POS, how they charge, and which machine each attempt went to.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('point_terminals', (table) => {
      table.increments('id')
      table.uuid('store_id').notNullable().references('id').inTable('stores').onDelete('CASCADE')
      /** Mercado Pago's terminal id ("NEWLAND_N950__N950NCB123456789"). */
      table.string('terminal_id', 120).notNullable()
      /** The staff's name for it ("Balcão"). */
      table.string('name', 60).notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      table.unique(['store_id', 'terminal_id'])
    })

    this.schema.alterTable('stores', (table) => {
      /** What the machine offers: credit_card, debit_card, qr (Pix/QR). */
      table
        .jsonb('point_payment_types')
        .notNullable()
        .defaultTo(JSON.stringify(['credit_card', 'debit_card']))
      /** Credit installments the POS may pick (1 = à vista). */
      table.smallint('point_max_installments').notNullable().defaultTo(1)
      /** The machine prints the receipt. */
      table.boolean('point_print_ticket').notNullable().defaultTo(true)
    })

    this.schema.alterTable('payments', (table) => {
      table.string('point_terminal_id', 120).nullable()
    })
  }

  async down() {
    this.schema.alterTable('payments', (table) => {
      table.dropColumn('point_terminal_id')
    })
    this.schema.alterTable('stores', (table) => {
      table.dropColumn('point_payment_types')
      table.dropColumn('point_max_installments')
      table.dropColumn('point_print_ticket')
    })
    this.schema.dropTable('point_terminals')
  }
}
