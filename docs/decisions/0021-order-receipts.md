# 0021. Orders paid in more than one go (receipts)

- Status: Accepted
- Date: 2026-11-14

## Context

The counter asked to add items to an order still waiting in the queue: the
customer wants a drink more before the kitchen starts. Until now an order
was paid once. Its row held the only payment (`payment_method`,
`counter_method`, `paid_at`, `paid_by_id`, `mercado_pago_payment_id`), and
several rules leaned on that:

- a gateway approval was a duplicate when its id wasn't the order's
  `mercado_pago_payment_id`, so a second charge on the card machine for the
  added items would have refunded the first one when its webhook came again;
- cancelling refunded only orders marked paid, so an order paid online with
  items still to receive would have kept the customer's money;
- the card machine charged the order's total;
- the sales report split payments by the order's single method.

## Decision

- **Receipts.** `order_receipts` holds every amount received: how
  (`payment_method`, and `counter_method` at the counter), who took it, when,
  and the gateway attempt that paid it (`payment_id`, unique).
  `orders.amount_paid` is their sum; the order is paid when it covers the
  total, and `amountDue` is what is left. Orders paid before get one receipt
  for their total (migration backfill).
- **One place records them**: `OrderService.markPaid` (counter, online, the
  card machine) and order creation at the POS (paid as it is sent). The
  order's own payment fields keep describing how it was *first* paid.
- **Duplicates are approvals the order didn't record**: an approval that
  finds nothing left to pay, or asks for more than is due (an older Pix paid
  after items were added to an order already paid), gets no receipt, and
  `PaymentService.settle` gives it back whole. The same approval notified
  again finds its receipt. A refunded order never reads as paid again, and
  stale online attempts don't change an order paid in part.
- **The amount the cashier confirmed is checked**: "Receber pagamento" and
  items added "pagos em" send the amount shown; if what is due changed
  meanwhile (someone added items), the API answers 409 `E_AMOUNT_CHANGED`
  and records nothing. Paid now, an addition takes all that is due (the
  dialog says what was already owed).
- **Refunds follow the gateway**: cancelling refunds every approved gateway
  attempt, whatever is still to receive. Money taken at the counter is given
  back by hand (the cancel dialog says so).
- **The card machine charges what is due.**
- **Reports** split payments by receipt, plus a row per method for what is
  still to receive.
- **Adding items** (`POST /orders/:id/items`, front of house): only while the
  order is `received` (nothing made yet), never with a charge waiting on the
  machine. The lines are priced, stock-checked and consumed like a new order,
  keep the order's place in the kitchen, and carry `added_at`/`added_by_id`.
  They are charged right away (`counterMethod`) or left to receive (the card
  machine, or at pickup). Removing items is not offered: cancel and place the
  order again. The request's Idempotency-Key is kept on the lines
  (`order_items.addition_key`), so a retry finds them even without the
  replay cache. The kitchen locks the order before its lines (like adding),
  so an order can't turn ready without lines added at the same moment.

## Consequences

- A paid order can go back to having something to receive; "Entregar" and
  "Receber pagamento" take only that part.
- The order's `counter_method` shows how it was first paid; the detail lists
  every receipt.
- New payment paths must go through `markPaid` (or create a receipt), or the
  order will never read as paid.
