import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import type OrderChannel from '#enums/order_channel'
import type OrderStatus from '#enums/order_status'
import type PaymentMethod from '#enums/payment_method'
import type PaymentStatus from '#enums/payment_status'
import { decimal } from '#helpers/columns'
import Customer from '#models/customer'
import OrderItem from '#models/order_item'
import OrderStatusHistory from '#models/order_status_history'
import Store from '#models/store'

export default class Order extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare storeId: string

  /** Sequential per store and business day. */
  @column()
  declare number: number

  @column.date()
  declare businessDate: DateTime

  @column()
  declare customerId: string | null

  @column()
  declare customerName: string

  @column()
  declare customerPhone: string | null

  @column()
  declare channel: OrderChannel

  @column()
  declare status: OrderStatus

  @column()
  declare paymentMethod: PaymentMethod

  @column()
  declare paymentStatus: PaymentStatus

  @column({ serializeAs: null })
  declare mercadoPagoPreferenceId: string | null

  @column({ serializeAs: null })
  declare mercadoPagoPaymentId: string | null

  @column(decimal)
  declare subtotal: number

  @column(decimal)
  declare total: number

  @column()
  declare notes: string | null

  /** Unguessable id for the public tracking page. */
  @column()
  declare publicToken: string

  @column()
  declare createdById: string | null

  /** Key of the request that created it; never serialized. */
  @column({ serializeAs: null })
  declare idempotencyKey: string | null

  @column.dateTime({ serializeAs: null })
  declare stockConsumedAt: DateTime | null

  @column.dateTime()
  declare readyAt: DateTime | null

  @column.dateTime()
  declare completedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Store)
  declare store: BelongsTo<typeof Store>

  @belongsTo(() => Customer)
  declare customer: BelongsTo<typeof Customer>

  @hasMany(() => OrderItem)
  declare items: HasMany<typeof OrderItem>

  @hasMany(() => OrderStatusHistory)
  declare history: HasMany<typeof OrderStatusHistory>
}
