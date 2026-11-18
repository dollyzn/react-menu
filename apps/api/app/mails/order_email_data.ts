import { addonLabels } from '#models/order_item_addon'
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

/**
 * `order` with `items.addons` preloaded. `cardFee`: what the customer paid
 * on top for the card (the store passes the fee on), shown before the total.
 */
export function orderEmailData(
  order: Order,
  at: DateTime = DateTime.now(),
  cardFee = 0
): OrderEmailData {
  const totals: OrderEmailData['totals'] = []
  if (order.subtotal !== order.total || cardFee > 0) {
    totals.push({ label: 'Subtotal', value: formatMoney(order.subtotal) })
  }
  if (cardFee > 0) totals.push({ label: 'Taxa do cartão', value: formatMoney(cardFee) })
  const paid = Math.round((order.total + cardFee) * 100) / 100
  totals.push({ label: 'Total', value: formatMoney(paid), strong: true })

  return {
    number: order.number,
    customerName: order.customerName,
    paymentMethod: order.paymentMethod,
    totalLabel: formatMoney(paid),
    paidAtLabel: at.setZone(BUSINESS_TIMEZONE).setLocale('pt-BR').toFormat("dd/MM/yyyy 'às' HH:mm"),
    trackingUrl: `${env.get('FRONTEND_URL')}/pedido/${order.publicToken}`,
    lines: order.items.map((line) => ({
      quantity: line.quantity,
      name: line.name,
      details: [
        ...addonLabels(line.addons).map((label) => `+ ${label}`),
        ...(line.notes ? [`Obs.: ${line.notes}`] : []),
      ],
      amount: formatMoney(line.total),
    })),
    totals,
  }
}
