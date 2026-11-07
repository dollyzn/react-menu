# 0020. Card machines (Mercado Pago Point) charged from the POS

- Status: Accepted
- Date: 2026-11-07

## Context

JJ Pastéis takes in-person card payments on Mercado Pago Point machines
(Point Pro and Point Smart), with the amount typed on the machine. The POS
already creates the order. Typing the amount again is slow and can be wrong,
and the payment never reaches the system, so the order is marked paid by
hand.

Mercado Pago Point charges through the same Orders API as the online
checkout (ADR 0017): `POST /v1/orders` with `type: "point"` and the machine's
`terminal_id`. The machine shows the charge, the customer pays, and the
`order` webhook reports the result. A machine must be in **PDV** operating
mode (`PATCH /terminals/v1/setup`) to receive charges. Each one needs its
own Mercado Pago point of sale (POS), set up in Mercado Pago and linked on
the machine. The store's existing access token lists the account's machines,
so no second application is needed.

## Decision

- **Same account and credentials** as the online checkout. A new
  `PointService` charges on the store's machines and reuses
  `MercadoPagoClient`, the `payments` table (method `point`, plus
  `point_terminal_id`) and the existing webhook (`order` topic, same
  signature check).
- **Machines per store**: `point_terminals` (the Mercado Pago id and a name).
  "Usar no PDV" puts a machine in PDV mode, and "Desativar" puts it back in
  STANDALONE. How the machine charges is set per store:
  `point_payment_types` (credit_card, debit_card, qr),
  `point_max_installments` and `point_print_ticket`.
- **The charge is an action on an order**, not a payment method chosen when
  it is created. A POS order goes to the kitchen at once, as before. "Enviar
  e cobrar na maquininha" sends it and then the charge, and the orders board
  can charge any unpaid order later ("Cobrar na maquininha"). A refused or
  cancelled charge leaves the order to be paid, so the staff can try again
  or take cash. An approved one marks the order paid with
  `payment_method = point`, so cancelling the order refunds it
  automatically like an online payment.
- **One charge at a time per order**, with an idempotency key the POS keeps
  across retries. The external reference is `<order id>_<attempt>`, because
  Mercado Pago wants it unique per charge.
- **Following the charge**: the POS polls our API every 2 s. Every 10 s it
  also asks Mercado Pago (`?check=1`), so a slow or unreachable webhook
  (development) doesn't leave it waiting. Charges expire after 10 minutes.
- **Cancelling**: a charge still `created` is cancelled through the API.
  Once it is on the machine's screen, Mercado Pago answers 409 for Point Pro
  machines, and the POS says to cancel on the machine (hold the red button).
- **Development**: with `PAYMENTS_FAKE_GATEWAY` and no credentials there is
  one pretend machine, and the POS offers "Simular aprovação/recusa".
  Mercado Pago's own test path (test credentials, a virtual machine and
  `POST /v1/orders/{id}/events`) is documented for manual checks.

## Consequences

- A machine in PDV mode is meant to take charges from the system. Whether
  it can still charge a typed amount is not documented, so the store keeps
  one machine in normal mode as a fallback.
- Pix/QR on the machine is an option per store. Whether a given model shows
  it must be checked on the device.
- Printing custom receipts (Terminals API) only exists on Point Smart and is
  not used. The machine prints its own receipt when `point_print_ticket` is
  on.
- Production needs the "Order (Mercado Pago)" webhook event, which the online
  checkout already requires.
