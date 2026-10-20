import OrderStatus from '#enums/order_status'

/** Allowed status transitions. Anything else is a 409 Conflict. */
const transitions: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.RECEIVED, OrderStatus.CANCELLED],
  [OrderStatus.RECEIVED]: [OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.RECEIVED, OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.PREPARING, OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
}

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return transitions[from].includes(to)
}

/** Orders the kitchen and the pickup counter are working on. */
export const ACTIVE_STATUSES = [
  OrderStatus.RECEIVED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
] as const
