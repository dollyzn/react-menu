import { exponentialBackoff } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import AppJob from '#jobs/app_job'
import OrderStatus from '#enums/order_status'
import PaymentAttemptStatus from '#enums/payment_attempt_status'
import Order from '#models/order'
import Payment from '#models/payment'
import OrderReceiptNotification from '#mails/order_receipt_notification'
import { storeBrand } from '#mails/layout'
import { orderEmailData } from '#mails/order_email_data'

type Payload = { paymentId: string }

/**
 * The customer's receipt after an online payment is approved, to the
 * e-mail typed at the payment step. Sent once per payment
 * (`receipt_sent_at`), even if webhooks repeat or the job is retried.
 */
export default class SendOrderReceipt extends AppJob<Payload> {
  static options: JobOptions = {
    maxRetries: 5,
    retry: { backoff: exponentialBackoff({ baseDelay: '30s', maxDelay: '30m' }) },
  }

  static async dispatchFor(payment: Payment) {
    if (!payment.payerEmail || payment.receiptSentAt) return
    await SendOrderReceipt.dispatch({ paymentId: payment.id }).dedup({ id: payment.id, ttl: '1d' })
  }

  async execute() {
    const payment = await Payment.find(this.payload.paymentId)
    if (!payment?.payerEmail || payment.receiptSentAt) return
    if (payment.status !== PaymentAttemptStatus.APPROVED) return

    const order = await Order.query()
      .where('id', payment.orderId)
      .preload('store')
      .preload('items', (items) => items.orderBy('id').preload('addons'))
      .first()
    // A late Pix on an expired order is refunded instead (the refund notice goes out).
    if (!order || order.status === OrderStatus.CANCELLED) return

    await mail.send(
      new OrderReceiptNotification(
        payment.payerEmail,
        { ...storeBrand(order.store), pickupEtaMinutes: order.store.pickupEtaMinutes },
        orderEmailData(order, payment.updatedAt)
      )
    )
    payment.receiptSentAt = DateTime.now()
    await payment.save()
  }
}
