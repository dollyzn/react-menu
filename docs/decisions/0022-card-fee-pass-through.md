# 0022. Card fee passed on to the customer (online checkout)

- Status: Accepted
- Date: 2026-11-17

## Context

Stores pay Mercado Pago's fee on every card payment made in the menu. Some
want the customer to pay it instead, as many delivery apps do, with a
different rate for credit and debit. Brazilian law (Lei 13.455/2017) allows a
different price by payment method as long as the customer is told before
paying. Pix stays free for the customer.

The fee can't simply raise the order's total: the order is priced when it is
placed, before the customer chooses how to pay, and the card may be refused
and the order then paid by Pix or at the counter. Receipts (ADR 0021) also
treat an approval for more than what is due as a duplicate, which a fee on
top would look like.

## Decision

- **Store settings**: `stores.card_fee_enabled`, `card_credit_fee_percent`,
  `card_debit_fee_percent` (0–20, two decimals), set with the Mercado Pago
  credentials (`PUT /stores/:id/payment-settings`, managers). Turned off, the
  percentages stay saved.
- **Kept apart from the order**: `PaymentService.pay` adds the fee
  (`#payments/card_fee`, rounded to the cent) to what the gateway charges.
  The attempt keeps `amount` (what goes to the order) and `fee` apart, and so
  does the receipt it pays (`order_receipts.fee`). `amount_paid`, `amountDue`
  and the duplicate check keep comparing the order's own money, and sales
  reports keep reporting the sale, not the fee.
- **Type decides the rate**: the card form's `paymentTypeId` (`debit_card` is
  debit, anything else credit). The customer picks credit or debit before the
  form, which then accepts only that type and shows the total with the fee.
- **The total shown is checked**: the page sends `amount`; a different total
  (settings changed meanwhile, or a type mismatch) is refused with 409
  `E_AMOUNT_CHANGED` before anything is charged.
- **Told before ordering**: the public menu's `cardFees` puts the rates on
  the "Cartão" option of the checkout, and the order's `checkout.cardFees`
  drives the payment step.
- **Refunds give it back**: a refund returns the whole Mercado Pago charge,
  fee included; the refund e-mail and the receipt e-mail show it.
- An attempt recorded from its webhook (its answer was lost) takes as fee what
  Mercado Pago charged beyond the order (`total_amount`).

## Alternatives considered

- **Raise the order's total when a card is chosen**: the total would change
  back and forth as the customer switches between Pix and card or the card is
  refused, and receipts would no longer match the items sold.
- **A fee per installment count**: closer to Mercado Pago's real costs, but
  harder to explain on the payment step; installment interest already follows
  the account's own setting.

## Consequences

- The card machine (Point) and counter payments don't charge a fee: the
  machine's own app decides there.
- Installment interest stays with the Mercado Pago account's setting; the fee
  is a percentage of the order, the same for any number of installments.
- Reports don't sum the fees received; the order detail shows them per order.
