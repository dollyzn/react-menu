const OrderChannel = {
  /** Customer ordered from the public menu. */
  ONLINE: 'online',
  /** Staff entered the order at the point of sale. */
  POS: 'pos',
  /** A partner sold it on their card machine (ADR 0024); `orders.partner_id`. */
  PARTNER: 'partner',
} as const

type OrderChannel = (typeof OrderChannel)[keyof typeof OrderChannel]

export default OrderChannel
