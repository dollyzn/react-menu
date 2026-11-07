import { inject } from '@adonisjs/core'
import { exponentialBackoff } from '@adonisjs/queue'
import AppJob from '#jobs/app_job'
import type { JobOptions } from '@adonisjs/queue/types'
import Payment from '#models/payment'
import PointService from '#services/point_service'

type Payload = { paymentId: string }

/**
 * When a card machine charge's time is up: reads it from Mercado Pago once
 * more (a lost webhook must not leave money taken and the order unpaid) and
 * closes it if it is still waiting.
 */
@inject()
export default class SettlePointCharge extends AppJob<Payload> {
  static options: JobOptions = {
    maxRetries: 5,
    retry: { backoff: exponentialBackoff({ baseDelay: '1m', maxDelay: '30m' }) },
  }

  constructor(private point: PointService) {
    super()
  }

  /** One minute after the charge's deadline. */
  static async scheduleFor(payment: Payment) {
    const wait = payment.expiresAt
      ? Math.max(60, Math.ceil(payment.expiresAt.diffNow('seconds').seconds) + 60)
      : 11 * 60
    await SettlePointCharge.dispatch({ paymentId: payment.id })
      .in(`${wait}s`)
      .dedup({ id: payment.id, ttl: '1h' })
  }

  async execute() {
    const payment = await Payment.find(this.payload.paymentId)
    if (!payment) return
    await this.point.settleExpired(payment)
  }
}
