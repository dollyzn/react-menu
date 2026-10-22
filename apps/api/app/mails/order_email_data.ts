import { DateTime } from 'luxon'
import env from '#start/env'
import type Order from '#models/order'
import { formatMoney } from '#mails/layout'
import { BUSINESS_TIMEZONE } from '#services/order_service'

/** What the customer e-mails show of an order, already formatted. */
export type OrderEmailData = {
  number: number
  customerName: string
  paymentMethod: string
  totalLabel: string
  paidAtLabel: string
  trackingUrl: string
  lines: { quantity: number; name: string; details: string[]; amount: string }[]
  totals: { label: string; value: string; strong?: boolean }[]
}

/** `order` with `items.addons` preloaded. */
export function orderEmailData(order: Order, at: DateTime = DateTime.now()): OrderEmailData {
  const totals: OrderEmailData['totals'] = []
  if (order.subtotal !== order.total) {
    totals.push({ label: 'Subtotal', value: formatMoney(order.subtotal) })
  }
  totals.push({ label: 'Total', value: formatMoney(order.total), strong: true })

  return {
    number: order.number,
    customerName: order.customerName,
    paymentMethod: order.paymentMethod,
    totalLabel: formatMoney(order.total),
    paidAtLabel: at.setZone(BUSINESS_TIMEZONE).setLocale('pt-BR').toFormat("dd/MM/yyyy 'às' HH:mm"),
    trackingUrl: `${env.get('FRONTEND_URL')}/pedido/${order.publicToken}`,
    lines: order.items.map((line) => ({
      quantity: line.quantity,
      name: line.name,
      details: [
        ...line.addons.map((addon) => `+ ${addon.name}`),
        ...(line.notes ? [`Obs.: ${line.notes}`] : []),
      ],
      amount: formatMoney(line.total),
    })),
    totals,
  }
}
