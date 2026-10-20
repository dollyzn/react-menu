const OrderChannel = {
  /** Customer ordered from the public menu. */
  ONLINE: 'online',
  /** Staff entered the order at the point of sale. */
  POS: 'pos',
} as const

type OrderChannel = (typeof OrderChannel)[keyof typeof OrderChannel]

export default OrderChannel
