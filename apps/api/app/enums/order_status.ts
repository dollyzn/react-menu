/**
 * pending_payment → received → preparing → ready → completed; cancelled from
 * any state before completed. Orders paid at the counter start at received.
 */
const OrderStatus = {
  PENDING_PAYMENT: 'pending_payment',
  RECEIVED: 'received',
  PREPARING: 'preparing',
  READY: 'ready',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const

type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus]

export default OrderStatus
