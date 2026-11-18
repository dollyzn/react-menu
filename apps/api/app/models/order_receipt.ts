import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { decimal } from '#helpers/columns'
import type CounterPaymentMethod from '#enums/counter_payment_method'
import type PaymentMethod from '#enums/payment_method'
import User from '#models/user'

/**
 * Money received for an order. An order is usually paid once; items added
 * while it waits in the queue are charged on their own, so it may have more
 * (see Order.amountPaid).
 */
export default class OrderReceipt extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column({ serializeAs: null })
  declare orderId: string

  @column(decimal)
  declare amount: number

  /** Card fee the customer paid on top (online checkout); not part of `amount`. */
  @column(decimal)
  declare fee: number

  /** How: counter, pix, card, point… (like Order.paymentMethod). */
  @column()
  declare paymentMethod: PaymentMethod

  /** At the counter: how the cashier took it. */
  @column()
  declare counterMethod: CounterPaymentMethod | null

  /** The gateway attempt that paid it (online or the card machine). */
  @column({ serializeAs: null })
  declare paymentId: string | null

  @column({ serializeAs: null })
  declare receivedById: string | null

  @column.dateTime()
  declare receivedAt: DateTime

  @column.dateTime({ autoCreate: true, serializeAs: null })
  declare createdAt: DateTime

  @belongsTo(() => User, { foreignKey: 'receivedById' })
  declare receivedBy: BelongsTo<typeof User>
}
