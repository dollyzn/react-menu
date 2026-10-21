/** One payment attempt of an order (an order may have several). */
const PaymentAttemptStatus = {
  /** Waiting for the customer (Pix not paid yet) or for the gateway. */
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  /** Pix that ran out of time, or a pending payment cancelled. */
  EXPIRED: 'expired',
  REFUNDED: 'refunded',
} as const

type PaymentAttemptStatus = (typeof PaymentAttemptStatus)[keyof typeof PaymentAttemptStatus]

export default PaymentAttemptStatus
