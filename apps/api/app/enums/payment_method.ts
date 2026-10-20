const PaymentMethod = {
  MERCADO_PAGO: 'mercado_pago',
  /** Paid at the pickup counter (cash, card or Pix in person). */
  COUNTER: 'counter',
} as const

type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod]

export default PaymentMethod
