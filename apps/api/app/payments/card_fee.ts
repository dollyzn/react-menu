import type Store from '#models/store'

/** Card types the store may charge a fee on (online checkout). */
export type CardType = 'credit' | 'debit'

/** The card form's payment type (`debit_card`, `credit_card`…); credit when missing. */
export const cardTypeOf = (paymentTypeId?: string | null): CardType =>
  paymentTypeId === 'debit_card' ? 'debit' : 'credit'

/** The store's percentages, or null when it doesn't pass the fee on. */
export function cardFeePercents(store: Store): Record<CardType, number> | null {
  if (!store.cardFeeEnabled) return null
  const percents = { credit: store.cardCreditFeePercent, debit: store.cardDebitFeePercent }
  return percents.credit > 0 || percents.debit > 0 ? percents : null
}

/**
 * What the customer pays on top of `amount` for a card of this type, to the
 * cent (half up). Zero when the store keeps the fee.
 */
export function cardFee(store: Store, amount: number, type: CardType) {
  const percent = cardFeePercents(store)?.[type] ?? 0
  // In cents first: 12.3 × 100 is 1230.0000000000002 in floating point.
  return Math.round((Math.round(amount * 100) * percent) / 100) / 100
}
