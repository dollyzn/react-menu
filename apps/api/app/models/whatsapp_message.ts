import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Order from '#models/order'
import Store from '#models/store'

/** Template with its parameters (named body ones, plus the URL button's suffix). */
export type TemplateContent = {
  type: 'template'
  name: string
  /** Body parameters by name. */
  params: Record<string, string>
  /** The URL button's dynamic part, when the template has one. */
  urlSuffix?: string
}

/** Free text: only inside the customer service window (the customer wrote to us). */
export type TextContent = { type: 'text'; body: string }

/** A login code (authentication template), sent in the request; the code itself is never kept. */
export type CodeContent = { type: 'code'; name: string }

export type MessageContent = TemplateContent | TextContent | CodeContent

export const MessageKind = {
  ORDER_RECEIVED: 'order_received',
  ORDER_PREPARING: 'order_preparing',
  ORDER_READY: 'order_ready',
  ORDER_COMPLETED: 'order_completed',
  ORDER_CANCELLED: 'order_cancelled',
  LOGIN_CODE: 'login_code',
  LOGIN_REPLY: 'login_reply',
} as const
export type MessageKind = (typeof MessageKind)[keyof typeof MessageKind]

/**
 * queued → sent → delivered → read, or failed; skipped: never sent (the
 * template wasn't approved, notices were turned off, the number broke).
 */
export const MessageStatus = {
  QUEUED: 'queued',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
  SKIPPED: 'skipped',
} as const
export type MessageStatus = (typeof MessageStatus)[keyof typeof MessageStatus]

/** Status webhooks may arrive out of order: never move backwards. */
const RANK: Record<string, number> = { queued: 0, sent: 1, delivered: 2, read: 3 }
export function isAfter(next: string, current: string) {
  if (current === MessageStatus.FAILED || current === MessageStatus.SKIPPED) return false
  if (next === MessageStatus.FAILED) return true
  return (RANK[next] ?? -1) > (RANK[current] ?? -1)
}

/** One message we send through a store's number, at most once per `dedupKey`. */
export default class WhatsAppMessage extends BaseModel {
  static table = 'whatsapp_messages'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare storeId: string

  @column()
  declare orderId: string | null

  @column()
  declare kind: MessageKind

  @column()
  declare dedupKey: string

  @column()
  declare to: string

  @column({ prepare: (value: MessageContent) => JSON.stringify(value) })
  declare content: MessageContent

  @column()
  declare wamid: string | null

  @column()
  declare status: MessageStatus

  @column()
  declare errorCode: number | null

  @column()
  declare errorTitle: string | null

  @column.dateTime()
  declare sentAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Store)
  declare store: BelongsTo<typeof Store>

  @belongsTo(() => Order)
  declare order: BelongsTo<typeof Order>
}
