import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import AppException from '#exceptions/app_exception'
import OrderChannel from '#enums/order_channel'
import OrderStatus from '#enums/order_status'
import type Order from '#models/order'
import Store from '#models/store'
import WhatsAppAccount from '#models/whatsapp_account'
import WhatsAppMessage, {
  isAfter,
  type MessageContent,
  MessageKind,
  MessageStatus,
} from '#models/whatsapp_message'
import WhatsAppAccountService from '#services/whatsapp_account_service'
import WhatsAppClient, { WhatsAppApiError } from '#whatsapp/client'
import {
  bodyParams,
  codeComponents,
  noticeOf,
  type NoticeKind,
  TEMPLATE_LANGUAGE,
  TEMPLATES,
  templateComponents,
  templateText,
} from '#whatsapp/templates'
import OrderItem from '#models/order_item'
import PaymentMethod from '#enums/payment_method'
import PaymentStatus from '#enums/payment_status'
import type { StatusUpdate } from '#whatsapp/webhook'

/** Same as #services/order_service (it imports this service: no import back). */
const BUSINESS_TIMEZONE = 'America/Sao_Paulo'

const KIND: Record<NoticeKind, MessageKind> = {
  received: MessageKind.ORDER_RECEIVED,
  preparing: MessageKind.ORDER_PREPARING,
  ready: MessageKind.ORDER_READY,
  completed: MessageKind.ORDER_COMPLETED,
  cancelled: MessageKind.ORDER_CANCELLED,
}

/** Which notice an order's current state calls for, and its dedup key. */
function orderNotice(order: Order): { notice: NoticeKind; key: string } | null {
  switch (order.status) {
    case OrderStatus.RECEIVED:
      return { notice: 'received', key: `order:${order.id}:received` }
    case OrderStatus.PREPARING:
      return { notice: 'preparing', key: `order:${order.id}:preparing` }
    case OrderStatus.READY:
      // Once per time it became ready (an order sent back and done again is told again).
      return order.readyAt
        ? { notice: 'ready', key: `order:${order.id}:ready:${order.readyAt.toMillis()}` }
        : null
    case OrderStatus.COMPLETED:
      return { notice: 'completed', key: `order:${order.id}:completed` }
    case OrderStatus.CANCELLED:
      return { notice: 'cancelled', key: `order:${order.id}:cancelled` }
    default:
      return null
  }
}

const brl = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\s/g, ' ')

/** How the order is paid, in the customer's words. */
function paymentLabel(order: Order) {
  if (order.paymentMethod === PaymentMethod.COUNTER) return 'Pagamento na retirada'
  const method = order.paymentMethod === PaymentMethod.PIX ? 'Pix' : 'Cartão'
  return order.paymentStatus === PaymentStatus.PAID ? `${method} (pago)` : method
}

/**
 * Messages through a store's number (ADR 0025): each one is a row first,
 * once per `dedup_key`, then sent by `SendWhatsAppMessage`; Meta's status
 * webhooks update it.
 */
@inject()
export default class WhatsAppMessageService {
  constructor(
    private client: WhatsAppClient,
    private accounts: WhatsAppAccountService
  ) {}

  /**
   * After an order changed (committed): queues the notice its new state
   * calls for, when the customer asked for them and the store can send it.
   * Returns the message to send, or null.
   */
  async queueOrderNotice(order: Order) {
    if (!order.whatsappOptIn || order.channel !== OrderChannel.ONLINE || !order.customerPhone) {
      return null
    }
    const next = orderNotice(order)
    if (!next) return null
    const notice = noticeOf(next.notice)

    const account = await this.accounts.forStore(order.storeId)
    if (!account || !account.isUsable || !account.notifyOrders) return null
    if (!account.noticeOn(notice.kind) || !account.templateApproved(notice.name)) return null
    // "Cancelado" only for an order the customer was told was received: an
    // unpaid Pix left to expire was never confirmed, and each notice is paid.
    if (notice.kind === 'cancelled') {
      const told = await WhatsAppMessage.query()
        .where({ dedupKey: `order:${order.id}:received` })
        .whereNotIn('status', [MessageStatus.FAILED, MessageStatus.SKIPPED])
        .first()
      if (!told) return null
    }

    // A new order's tracking token is the database's default: not on the model yet.
    if (!order.publicToken) await order.refresh()
    const store = await Store.findOrFail(order.storeId)
    const values: Record<string, () => Promise<string> | string> = {
      cliente: () => templateText(order.customerName.split(' ')[0] || order.customerName, 40),
      numero: () => String(order.number),
      loja: () => templateText(store.name, 60),
      itens: async () => {
        const lines = await OrderItem.query().where('orderId', order.id).orderBy('id')
        const text = lines
          .map((line) => `${line.quantity}x ${line.displayName ?? line.name}`)
          .join(', ')
        return templateText(text, 400)
      },
      pagamento: () => paymentLabel(order),
      total: () => brl(order.total),
      previsao: () => `fica pronto em cerca de ${store.pickupEtaMinutes} minutos`,
    }
    const params: Record<string, string> = {}
    for (const param of bodyParams(notice.body)) params[param] = await values[param]()

    return await this.queue({
      storeId: order.storeId,
      orderId: order.id,
      kind: KIND[notice.kind],
      dedupKey: next.key,
      to: order.customerPhone,
      content: {
        type: 'template',
        name: notice.name,
        params,
        ...(notice.button && { urlSuffix: order.publicToken }),
      },
    })
  }

  /**
   * A row per message, at most once per key: a repeated change, a retried
   * request or a second webhook never sends it twice. A row already there
   * and still queued (its dispatch failed: Redis down) is dispatched again;
   * the job's dedup and `deliver`'s status check keep it to one send.
   */
  async queue(input: {
    storeId: string
    orderId?: string | null
    kind: MessageKind
    dedupKey: string
    to: string
    content: MessageContent
  }) {
    const [row] = await db
      .knexQuery()
      .table('whatsapp_messages')
      .insert({
        store_id: input.storeId,
        order_id: input.orderId ?? null,
        kind: input.kind,
        dedup_key: input.dedupKey,
        to: input.to,
        content: JSON.stringify(input.content),
        status: MessageStatus.QUEUED,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .onConflict('dedup_key')
      .ignore()
      .returning('id')
    const message = row
      ? await WhatsAppMessage.findOrFail(row.id ?? row)
      : await WhatsAppMessage.findBy('dedupKey', input.dedupKey)
    if (!message || message.status !== MessageStatus.QUEUED) return null
    const { default: SendWhatsAppMessage } = await import('#jobs/send_whatsapp_message')
    await SendWhatsAppMessage.dispatchFor(message)
    return message
  }

  /** The job gave up (Meta kept not answering): the row says so instead of staying queued. */
  async giveUp(messageId: string, error: Error) {
    await WhatsAppMessage.query()
      .where({ id: messageId, status: MessageStatus.QUEUED })
      .update({ status: MessageStatus.FAILED, errorTitle: error.message.slice(0, 300) })
  }

  /**
   * The panel's list: the store's last messages (no contents: codes are
   * never kept anyway), and today's count per status.
   */
  async recent(storeId: string, limit = 30) {
    const rows = await WhatsAppMessage.query()
      .where('storeId', storeId)
      .preload('order', (order) => order.select('id', 'number', 'customerName'))
      .orderBy('createdAt', 'desc')
      .limit(limit)
    const startOfDay = DateTime.now().setZone(BUSINESS_TIMEZONE).startOf('day')
    const counts = await db
      .from('whatsapp_messages')
      .where('store_id', storeId)
      .where('created_at', '>=', startOfDay.toJSDate())
      .groupBy('status')
      .select('status')
      .count('* as total')
    const today = Object.fromEntries(
      Object.values(MessageStatus).map((status) => [
        status,
        Number(counts.find((row) => row.status === status)?.total ?? 0),
      ])
    ) as Record<MessageStatus, number>
    return {
      today,
      messages: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        to: row.to.replace(/^(\d{4})\d+(\d{4})$/, '$1•••••$2'),
        status: row.status,
        errorCode: row.errorCode,
        errorTitle: row.errorTitle,
        orderNumber: row.order?.number ?? null,
        customerName: row.order?.customerName ?? null,
        createdAt: row.createdAt.toISO()!,
        updatedAt: row.updatedAt.toISO()!,
      })),
    }
  }

  /**
   * Sends a queued message (the job). Throws only for what a retry may fix
   * (no answer, rate limits); anything else is recorded on the row.
   */
  async deliver(messageId: string) {
    const message = await WhatsAppMessage.find(messageId)
    if (!message || message.status !== MessageStatus.QUEUED) return

    const account = await WhatsAppAccount.findBy('storeId', message.storeId)
    if (!account || !account.isUsable) {
      await this.skip(message, 'WhatsApp desconectado')
      return
    }
    const content = message.content
    if (content.type === 'template' && !account.templateApproved(content.name)) {
      await this.skip(message, 'Modelo de mensagem não aprovado')
      return
    }
    if (content.type === 'code') {
      await this.skip(message, 'Código enviado na hora, nunca por fila')
      return
    }

    try {
      const result =
        content.type === 'template'
          ? await this.client.sendTemplate(account.accessToken, account.phoneNumberId, message.to, {
              name: content.name,
              language: TEMPLATE_LANGUAGE,
              components: templateComponents(content.params, content.urlSuffix),
            })
          : await this.client.sendText(
              account.accessToken,
              account.phoneNumberId,
              message.to,
              content.body
            )
      message.wamid = result.messages?.[0]?.id ?? null
      message.status = MessageStatus.SENT
      message.sentAt = DateTime.now()
      await message.save()
    } catch (error) {
      if (error instanceof WhatsAppApiError && error.transient) throw error
      await this.fail(message, account, error)
    }
  }

  /**
   * A login code (authentication template), sent while the customer waits:
   * its failure is the answer. The row keeps that it was sent, never the code.
   */
  async sendCode(account: WhatsAppAccount, challengeId: string, to: string, code: string) {
    const message = await WhatsAppMessage.create({
      storeId: account.storeId,
      kind: MessageKind.LOGIN_CODE,
      dedupKey: `login:${challengeId}:code`,
      to,
      content: { type: 'code', name: TEMPLATES.LOGIN_CODE },
      status: MessageStatus.QUEUED,
    })
    try {
      const result = await this.client.sendTemplate(
        account.accessToken,
        account.phoneNumberId,
        to,
        {
          name: TEMPLATES.LOGIN_CODE,
          language: TEMPLATE_LANGUAGE,
          components: codeComponents(code),
        }
      )
      message.wamid = result.messages?.[0]?.id ?? null
      message.status = MessageStatus.SENT
      message.sentAt = DateTime.now()
      await message.save()
    } catch (error) {
      await this.fail(message, account, error)
      if (error instanceof WhatsAppApiError && error.status === 0) {
        throw new AppException(
          'O WhatsApp não respondeu. Tente de novo em instantes.',
          503,
          'E_WHATSAPP_UNAVAILABLE'
        )
      }
      if (error instanceof WhatsAppApiError && error.code === 131026) {
        throw new AppException(
          'Esse número não recebe mensagens no WhatsApp. Confira o número.',
          422,
          'E_WHATSAPP_UNDELIVERABLE'
        )
      }
      throw new AppException(
        'Não foi possível enviar o código agora. Tente pelo outro jeito ou mais tarde.',
        502,
        'E_WHATSAPP_SEND'
      )
    }
  }

  /** A status webhook: moves the row forward (never back) and notes payment problems. */
  async applyStatus(account: WhatsAppAccount, update: StatusUpdate) {
    const message = await WhatsAppMessage.query()
      .where({ wamid: update.id, storeId: account.storeId })
      .first()
    if (!message) return

    const next =
      update.status === 'failed'
        ? MessageStatus.FAILED
        : update.status === 'played'
          ? MessageStatus.READ
          : (update.status as MessageStatus)
    if (!isAfter(next, message.status)) return

    message.status = next
    const error = update.errors?.[0]
    if (next === MessageStatus.FAILED && error) {
      message.errorCode = error.code
      message.errorTitle = (error.error_data?.details || error.message || error.title || '').slice(
        0,
        300
      )
      if (error.code === 131042 && !account.paymentIssueAt) {
        account.paymentIssueAt = DateTime.now()
        await account.save()
      }
    }
    await message.save()

    // Something got through: the payment method is fine again.
    if (next === MessageStatus.DELIVERED && account.paymentIssueAt) {
      account.paymentIssueAt = null
      await account.save()
    }
  }

  private async skip(message: WhatsAppMessage, reason: string) {
    message.status = MessageStatus.SKIPPED
    message.errorTitle = reason
    await message.save()
  }

  private async fail(message: WhatsAppMessage, account: WhatsAppAccount, error: unknown) {
    message.status = MessageStatus.FAILED
    if (error instanceof WhatsAppApiError) {
      message.errorCode = error.code
      message.errorTitle = (error.details || error.message).slice(0, 300)
      await this.accounts.noteFailure(account, error)
    } else {
      logger.error({ err: error, messageId: message.id }, 'could not send a WhatsApp message')
      message.errorTitle = 'Erro interno'
    }
    await message.save()
  }
}
