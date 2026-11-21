import { createHmac } from 'node:crypto'
import AppException from '#exceptions/app_exception'
import MercadoPagoClient, { type MercadoPagoOrder } from '#payments/mercado_pago_client'
import type { MercadoPagoTerminal, PointOrderInput } from '#payments/point'

/** Mercado Pago's Point side for tests (ADR 0020): see point.spec.ts and partners.spec.ts. */
export const TOKEN = 'TEST-1234567890-abcdef' // gitleaks:allow (fake test credential)
export const SECRET = 'webhook-secret-123'
export const BALCAO = 'NEWLAND_N950__N950NCB400655765'
export const RESERVA = 'PAX_Q92__Q92-1734068575'

/** Mercado Pago's Point side: machines, charges on them, their outcomes. */
export class FakePoint extends MercadoPagoClient {
  terminals: MercadoPagoTerminal[] = [
    { id: BALCAO, pos_id: 1, store_id: '1', operating_mode: 'STANDALONE' },
    { id: RESERVA, pos_id: 1, store_id: '1', operating_mode: 'STANDALONE' },
  ]
  charges: { input: PointOrderInput; idempotencyKey: string }[] = []
  orders = new Map<string, MercadoPagoOrder>()
  refunds: string[] = []
  private next = 2001

  async listTerminals() {
    return this.terminals
  }

  async setTerminalMode(_token: string, terminalId: string, mode: 'PDV' | 'STANDALONE') {
    this.terminals.find((terminal) => terminal.id === terminalId)!.operating_mode = mode
  }

  async createPointOrder(_token: string, input: PointOrderInput, idempotencyKey: string) {
    this.charges.push({ input, idempotencyKey })
    const id = `ORD${this.next++}`
    const order: MercadoPagoOrder = {
      id,
      status: 'created',
      status_detail: 'created',
      external_reference: input.external_reference,
      transactions: { payments: [{ id: `PAY${id}`, status: 'created' }] },
    }
    this.orders.set(id, order)
    return order
  }

  /** What the machine reports: paid, refused, or on its screen. */
  set(id: string, status: string, detail: string) {
    const order = this.orders.get(id)!
    order.status = status
    order.status_detail = detail
    order.transactions!.payments![0].status = status
    order.transactions!.payments![0].status_detail = detail
  }

  async getOrder(_token: string, orderId: string) {
    return this.orders.get(orderId)!
  }

  async cancelOrder(_token: string, orderId: string) {
    const order = this.orders.get(orderId)!
    if (order.status === 'at_terminal') {
      throw new AppException('on the machine', 409, 'E_CANCEL_ON_TERMINAL')
    }
    this.set(orderId, 'canceled', 'canceled_by_api')
    return order
  }

  async refundOrder(_token: string, orderId: string) {
    this.refunds.push(orderId)
  }
}

export function signature(dataId: string, requestId: string) {
  const ts = '1700000000'
  const v1 = createHmac('sha256', SECRET)
    .update(`id:${dataId};request-id:${requestId};ts:${ts};`)
    .digest('hex')
  return `ts=${ts},v1=${v1}`
}
