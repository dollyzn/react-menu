import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type PaymentAttemptStatus from '#enums/payment_attempt_status'
import type PaymentMethod from '#enums/payment_method'
import { decimal } from '#helpers/columns'
import Order from '#models/order'

/** One attempt to pay an order online (Pix or card) through a gateway. */
export default class Payment extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare orderId: string

  @column()
  declare storeId: string

  @column()
  declare gateway: string

  @column()
  declare method: PaymentMethod

  @column()
  declare gatewayPaymentId: string | null

  @column()
  declare status: PaymentAttemptStatus

  @column()
  declare statusDetail: string | null

  @column(decimal)
  declare amount: number

  @column()
  declare pixQrCode: string | null

  @column()
  declare pixTicketUrl: string | null

  @column.dateTime()
  declare expiresAt: DateTime | null

  /** Typed by the customer at the payment step; receipts are sent there. */
  @column()
  declare payerEmail: string | null

  @column.dateTime()
  declare receiptSentAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Order)
  declare order: BelongsTo<typeof Order>
}
