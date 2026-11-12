/**
 * How a counter order was paid, as the cashier recorded it (POS, or
 * "Receber pagamento" on the board). The card machine integrated with the
 * system is `PaymentMethod.POINT`; credit/debit here are charged on a
 * machine outside it.
 */
const CounterPaymentMethod = {
  CASH: 'cash',
  PIX: 'pix',
  CREDIT: 'credit',
  DEBIT: 'debit',
} as const

type CounterPaymentMethod = (typeof CounterPaymentMethod)[keyof typeof CounterPaymentMethod]

export const COUNTER_PAYMENT_METHODS = Object.values(CounterPaymentMethod)

export default CounterPaymentMethod
