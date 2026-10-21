const PaymentMethod = {
  /** Pix QR code shown in the app (online). */
  PIX: 'pix',
  /** Credit/debit card typed in the app, tokenized by the gateway (online). */
  CARD: 'card',
  /** Paid at the pickup counter (cash, card or Pix in person). */
  COUNTER: 'counter',
  /** Legacy Mercado Pago Checkout Pro (redirect). Kept for older orders only. */
  MERCADO_PAGO: 'mercado_pago',
} as const

type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod]

/** Paid through a gateway before the order enters the kitchen. */
export function isOnlinePayment(method: PaymentMethod) {
  return method !== PaymentMethod.COUNTER
}

export default PaymentMethod
