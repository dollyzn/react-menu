/**
 * Mercado Pago's virtual machine for test credentials: serial SBX0000001 on
 * a model's id. Its results are simulated with POST /v1/orders/{id}/events.
 */
export const SANDBOX_TERMINAL = 'NEWLAND_N950__SBX0000001'

/** How the card machine charges (Mercado Pago's `default_type`). */
export const POINT_PAYMENT_TYPES = ['credit_card', 'debit_card', 'qr'] as const
export type PointPaymentType = (typeof POINT_PAYMENT_TYPES)[number]

/** A card machine of the account, as Mercado Pago lists it. */
export type MercadoPagoTerminal = {
  id: string
  pos_id?: number | null
  store_id?: string | null
  external_pos_id?: string | null
  /** PDV: charges come from the system; STANDALONE: typed on the machine. */
  operating_mode?: 'PDV' | 'STANDALONE' | 'UNDEFINED' | string
}

/** Body of POST /v1/orders for the card machine. */
export type PointOrderInput = {
  type: 'point'
  /** Unique per attempt: letters, numbers, "-" and "_" (up to 64). */
  external_reference: string
  /** ISO 8601 duration, 30 s to 3 h (Mercado Pago's default: 15 min). */
  expiration_time: string
  description: string
  transactions: { payments: { amount: string }[] }
  config: {
    point: { terminal_id: string; print_on_terminal: 'seller_ticket' | 'no_ticket' }
    payment_method?: {
      default_type?: PointPaymentType
      default_installments?: number
      installments_cost?: 'seller' | 'buyer'
    }
  }
}

/**
 * The attempt's external reference: the order id plus a suffix (Mercado
 * Pago wants it unique per charge); `orderIdOf` reads the order back.
 */
export const pointReference = (orderId: string, attempt: string) => `${orderId}_${attempt}`
export const orderIdOf = (reference: string | null | undefined) =>
  reference ? reference.split('_')[0] : null

/** "NEWLAND_N950__N950NCB123456789" → "NEWLAND N950" and its serial, for people. */
export function describeTerminal(id: string) {
  const [model = id, serial = ''] = id.split('__')
  return { model: model.replace(/_/g, ' '), serial }
}
