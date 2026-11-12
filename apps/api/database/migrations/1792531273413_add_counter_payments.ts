import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Counter payments are recorded with how they were paid (cash, Pix, credit,
 * debit on a machine outside the system), who received them and when. The
 * list is written out so the constraint doesn't depend on when this runs.
 */
const METHODS = ['cash', 'pix', 'credit', 'debit']

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('orders', (table) => {
      table.text('counter_method').nullable()
      table.timestamp('paid_at', { useTz: true }).nullable()
      table.uuid('paid_by_id').nullable().references('id').inTable('users').onDelete('SET NULL')
    })
    this.schema.raw(
      `ALTER TABLE orders ADD CONSTRAINT orders_counter_method_check CHECK (counter_method IS NULL OR counter_method IN (${METHODS.map((method) => `'${method}'`).join(', ')}))`
    )
  }

  async down() {
    this.schema.raw('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_counter_method_check')
    this.schema.alterTable('orders', (table) => {
      table.dropColumn('paid_by_id')
      table.dropColumn('paid_at')
      table.dropColumn('counter_method')
    })
  }
}
