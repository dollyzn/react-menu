import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Orders paid on the card machine (ADR 0020) carry payment_method 'point'.
 * The check constraint was built from the enum when 1792531273393 ran, so
 * databases migrated before 'point' existed refuse it. The list is written
 * out here so it doesn't depend on when this runs.
 */
const METHODS = ['pix', 'card', 'point', 'counter', 'mercado_pago']
const BEFORE = ['pix', 'card', 'counter', 'mercado_pago']

const check = (methods: string[]) =>
  `ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IN (${methods
    .map((method) => `'${method}'`)
    .join(', ')}))`

export default class extends BaseSchema {
  async up() {
    this.schema.raw('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check')
    this.schema.raw(check(METHODS))
  }

  async down() {
    this.schema.raw('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check')
    this.schema.raw(check(BEFORE))
  }
}
