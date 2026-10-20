const PaymentStatus = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const

type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus]

export default PaymentStatus
