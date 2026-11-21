import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Partners (ADR 0024): someone outside the store who sells its menu to
 * their own customers on a card machine the store lent them, for a
 * commission. They work in a partner area of the panel (role `partner`,
 * linked to one partner), the store's kitchen makes their orders and the
 * staff hand them over to the partner, who then hands them to the customer.
 *
 * Check constraints are written out here (not built from the enums), so
 * they don't depend on when this runs (see 1792531273411).
 */
const ROLES = ['manager', 'attendant', 'kitchen', 'partner']
const ROLES_BEFORE = ['manager', 'attendant', 'kitchen']
const CHANNELS = ['online', 'pos', 'partner']
const CHANNELS_BEFORE = ['online', 'pos']

const list = (values: string[]) => values.map((value) => `'${value}'`).join(', ')

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('store_partners', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('uuid_generate_v4()'))
      table.uuid('store_id').notNullable().references('id').inTable('stores').onDelete('CASCADE')
      table.string('name', 80).notNullable()
      // percent: of the order's subtotal; per_unit: R$ per unit sold.
      table.enum('commission_type', ['percent', 'per_unit']).notNullable()
      table.decimal('commission_value', 10, 2).notNullable()
      // When the rule above last changed (orders keep the commission of their time).
      table.timestamp('commission_updated_at', { useTz: true }).notNullable()
      // Up to when the partner cancels alone; past that they ask a manager.
      table.enum('cancel_policy', ['never', 'until_kitchen', 'until_ready']).notNullable()
      // all: the whole menu; selected: the categories below minus the excluded items.
      table.enum('catalog_mode', ['all', 'selected']).notNullable().defaultTo('all')
      // Paused: no new orders (partners with orders are paused, never deleted).
      table.timestamp('paused_at', { useTz: true }).nullable()
      table.timestamps(true, true)
      table.unique(['store_id', 'name'])
    })

    this.schema.createTable('store_partner_categories', (table) => {
      table
        .uuid('partner_id')
        .notNullable()
        .references('id')
        .inTable('store_partners')
        .onDelete('CASCADE')
      table
        .integer('category_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('categories')
        .onDelete('CASCADE')
      table.primary(['partner_id', 'category_id'])
    })

    this.schema.createTable('store_partner_excluded_items', (table) => {
      table
        .uuid('partner_id')
        .notNullable()
        .references('id')
        .inTable('store_partners')
        .onDelete('CASCADE')
      table.uuid('item_id').notNullable().references('id').inTable('items').onDelete('CASCADE')
      table.primary(['partner_id', 'item_id'])
    })

    this.schema.raw('ALTER TABLE store_user DROP CONSTRAINT IF EXISTS store_user_role_check')
    this.schema.raw(
      `ALTER TABLE store_user ADD CONSTRAINT store_user_role_check CHECK (role IN (${list(ROLES)}))`
    )
    this.schema.alterTable('store_user', (table) => {
      table
        .uuid('partner_id')
        .nullable()
        .references('id')
        .inTable('store_partners')
        .onDelete('RESTRICT')
      table.index(['partner_id'])
    })
    // A partner member always belongs to one partner; nobody else does.
    this.schema.raw(
      `ALTER TABLE store_user ADD CONSTRAINT store_user_partner_check CHECK ((role = 'partner') = (partner_id IS NOT NULL))`
    )

    // The machine lent to a partner (null: the store's own).
    this.schema.alterTable('point_terminals', (table) => {
      table
        .uuid('partner_id')
        .nullable()
        .references('id')
        .inTable('store_partners')
        .onDelete('SET NULL')
    })

    this.schema.createTable('partner_settlements', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('uuid_generate_v4()'))
      table.uuid('store_id').notNullable().references('id').inTable('stores').onDelete('CASCADE')
      table
        .uuid('partner_id')
        .notNullable()
        .references('id')
        .inTable('store_partners')
        .onDelete('RESTRICT')
      // Orders handed over up to this business day (or the ones picked).
      table.date('until').nullable()
      table.integer('orders_count').notNullable()
      table.decimal('total', 10, 2).notNullable()
      table.text('note').nullable()
      table.timestamp('paid_at', { useTz: true }).notNullable()
      table.uuid('paid_by_id').nullable().references('id').inTable('users').onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.index(['store_id', 'partner_id', 'paid_at'])
    })

    this.schema.raw('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_channel_check')
    this.schema.raw(
      `ALTER TABLE orders ADD CONSTRAINT orders_channel_check CHECK (channel IN (${list(CHANNELS)}))`
    )
    this.schema.alterTable('orders', (table) => {
      table
        .uuid('partner_id')
        .nullable()
        .references('id')
        .inTable('store_partners')
        .onDelete('RESTRICT')
      // Snapshot of the partner's commission when it was placed.
      table.decimal('commission_amount', 10, 2).nullable()
      // Second hand-over: the partner gave it to their customer.
      table.timestamp('partner_delivered_at', { useTz: true }).nullable()
      table
        .uuid('partner_delivered_by_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table
        .uuid('partner_settlement_id')
        .nullable()
        .references('id')
        .inTable('partner_settlements')
        .onDelete('SET NULL')
      table.index(['store_id', 'partner_id', 'created_at'])
      table.index(['partner_settlement_id'])
    })

    this.schema.createTable('order_cancel_requests', (table) => {
      table.increments('id')
      table.uuid('store_id').notNullable().references('id').inTable('stores').onDelete('CASCADE')
      table.uuid('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE')
      table
        .uuid('requested_by_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.text('reason').notNullable()
      table.enum('status', ['pending', 'approved', 'rejected']).notNullable()
      table.uuid('decided_by_id').nullable().references('id').inTable('users').onDelete('SET NULL')
      table.timestamp('decided_at', { useTz: true }).nullable()
      table.text('decision_note').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.index(['store_id', 'status'])
      table.index(['order_id'])
    })
    // One request waiting per order.
    this.schema.raw(
      `CREATE UNIQUE INDEX order_cancel_requests_one_pending ON order_cancel_requests (order_id) WHERE status = 'pending'`
    )
  }

  async down() {
    this.schema.dropTable('order_cancel_requests')
    this.schema.alterTable('orders', (table) => {
      table.dropIndex(['partner_settlement_id'])
      table.dropIndex(['store_id', 'partner_id', 'created_at'])
      table.dropColumn('partner_settlement_id')
      table.dropColumn('partner_delivered_by_id')
      table.dropColumn('partner_delivered_at')
      table.dropColumn('commission_amount')
      table.dropColumn('partner_id')
    })
    this.schema.raw('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_channel_check')
    this.schema.raw(
      `ALTER TABLE orders ADD CONSTRAINT orders_channel_check CHECK (channel IN (${list(CHANNELS_BEFORE)}))`
    )
    this.schema.dropTable('partner_settlements')
    this.schema.alterTable('point_terminals', (table) => {
      table.dropColumn('partner_id')
    })
    this.schema.raw('ALTER TABLE store_user DROP CONSTRAINT IF EXISTS store_user_partner_check')
    this.schema.alterTable('store_user', (table) => {
      table.dropIndex(['partner_id'])
      table.dropColumn('partner_id')
    })
    this.schema.raw('ALTER TABLE store_user DROP CONSTRAINT IF EXISTS store_user_role_check')
    this.schema.raw(
      `ALTER TABLE store_user ADD CONSTRAINT store_user_role_check CHECK (role IN (${list(ROLES_BEFORE)}))`
    )
    this.schema.dropTable('store_partner_excluded_items')
    this.schema.dropTable('store_partner_categories')
    this.schema.dropTable('store_partners')
  }
}
