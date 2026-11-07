const PaymentMethod = {
  /** Pix QR code shown in the app (online). */
  PIX: 'pix',
  /** Credit/debit card typed in the app, tokenized by the gateway (online). */
  CARD: 'card',
  /** Charged on the store's Mercado Pago Point card machine from the POS (ADR 0020). */
  POINT: 'point',
  /** Paid at the pickup counter (cash, card or Pix in person). */
  COUNTER: 'counter',
  /** Legacy Mercado Pago Checkout Pro (redirect). Kept for older orders only. */
  MERCADO_PAGO: 'mercado_pago',
} as const

type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod]

/** Paid through a gateway (online, or the card machine): refunded when cancelled. */
export function isOnlinePayment(method: PaymentMethod) {
  return method !== PaymentMethod.COUNTER
}

export default PaymentMethod
