# 0024. Partners who sell the store's menu

- Status: Accepted (extends 0010 and 0020)
- Date: 2026-11-20

## Context

Someone outside the store (the açaí shop next door) wants to sell JJ
Pastéis' pastries to their own customers. The store makes the order and
hands it over to the partner, and the partner hands it to the customer. The
store lends the partner a card machine, so all the money lands in the store's
Mercado Pago account. The partner earns a commission. The store pays it
outside the system and only wants to see what it owes and mark it paid.

The partner must see their own sales, orders and commission, and nothing of
the store's: other orders, customers, reports, the catalog editor. Orders
must never reach the kitchen unpaid, so nobody can fill the counter with
pastries that are never collected.

## Decision

- **A partner is an entity of the store** (`store_partners`), separate from
  the people who sell for it. It holds the name, the commission rule, the
  cancellation rule, what it may sell, and whether its sales are paused.
  People join with the store role `partner`, and `store_user.partner_id`
  links them to one partner (a check constraint: role `partner` ⇔
  `partner_id`). They can be invited together with a new partner
  (`newPartner` on `POST /members`). Partners are paused, never deleted.
- **Closed by default.** `storeAccess` refuses role `partner` on every
  `/stores/:storeId/*` route outside the partner area
  (`/stores/:storeId/partner/*`, `isPartnerArea`), and refuses everyone else
  inside it. A store route without a role guard therefore never shows a
  partner the store's data. Partners get their own Transmit channel
  (`stores/:id/partners/:partnerId`, for the partner's people and the
  managers) and are refused on `stores/:id`. `notifyStoreMembers` leaves
  them out unless `roles` names them. Their customers never become the
  store's `customers`.
- **Orders**: channel `partner`, `orders.partner_id`. They are priced like
  any order, but only with items the partner may sell
  (`catalog_mode` `all`, or `selected` categories minus excluded items:
  `sellsItem`, 422 `E_NOT_FOR_PARTNER`), only while the partner isn't paused
  and the store is open. They always wait in `pending_payment` until the
  machine approves them. Daily numbering is shared with the store.
- **The machine decides by the order.** `point_terminals.partner_id` lends a
  machine to a partner. `PointService.charge` uses only the order's
  partner's machines (the store's orders: only the store's own), and the
  pending charges are filtered the same way. The partner area reuses the
  POS's charge actions under its own prefix.
- **Commission is a snapshot** (`orders.commission_amount`, from the pure
  `#partners/commission`): a percentage of the subtotal (without the card
  fee) or a value per unit, rounded half up to the cent. A new rule applies
  to new orders only (`commission_updated_at`), and the partner is told
  (`partner.commission_changed`). The partner's POS shows a preview with the
  same rule. It counts for paid, not cancelled orders: in progress (not
  handed over yet), to receive (handed over, not settled), received.
- **Settlements** (`partner_settlements`) only record that commission was
  paid: either every order to receive up to a business day, or the orders
  picked. The orders point to their settlement (`partner_settlement_id`),
  so none is paid twice. A settlement can be undone.
- **Two hand-overs, one state machine.** For a partner's order,
  `completed` means "the store handed it to the partner". The second
  hand-over is `orders.partner_delivered_at`, set by the partner
  ("Entreguei ao cliente", only after `completed`, idempotent). The partner
  is told when the order is ready and when it was handed over
  (`partner.order_ready`, `partner.order_handed_over`).
- **Cancelling** follows the partner's `cancel_policy` (pure
  `#partners/cancel_policy`). An unpaid order can always be dropped.
  Within the window (`until_kitchen`: received; `until_ready`: received or
  preparing) the partner cancels, and a paid order is refunded like any
  other. Past the window, or with `never`, the partner asks
  (`order_cancel_requests`, at most one pending per order: 409
  `E_CANCEL_REQUIRES_APPROVAL` on cancel). The managers are told, the board
  and the kitchen mark the order, and "Entregar" answers 409
  `E_CANCEL_REQUESTED` until a manager approves (cancels through
  `OrderCancellationService`) or refuses. Any cancellation answers the
  pending request as approved.

## Alternatives considered

- **The partner as another store** ordering wholesale from JJ: their own
  menu and prices, but orders between stores, a kitchen that doesn't see
  them as its own, and money split between accounts. Not needed for a
  commission.
- **Just a "sold by" tag on POS orders**: no access for the partner, so
  they couldn't see their orders or commission.
- **A new order status** for "with the partner": it would touch the state
  machine, the board, the kitchen, the reports and every `ACTIVE_STATUSES`
  user for something only partners need.
- **Moving the commission money in the system**: out of scope; the store
  pays it by hand and records it.

## Consequences

- New store routes are closed to partners unless they live in the partner
  area. Partner screens never call the store's endpoints (the web's
  `PartnerAreaGate`, `usePointConfig(storeId, "partner")`).
- A machine lent to a partner is in PDV mode, so it only charges from the
  system: the partner needs internet to sell.
- Per-item commission (a value for some items) can come later, as a table
  overriding the general rule. Snapshots keep the past orders as they were.
