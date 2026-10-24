# 0018. 3-D Secure on card payments

- Status: Accepted
- Date: 2026-10-24

## Context

ADR 0017 moved card payments to Mercado Pago's Orders API without 3-D
Secure: a card the bank wanted to confirm stayed pending until it expired.
The Orders API supports 3DS 2.0: the order asks for it, and when the bank
wants a confirmation the order answers `action_required`/`pending_challenge`
with a challenge URL the payer must open within 40 minutes.

## Decision

- Card orders send `config.online.transaction_security` with
  `validation: on_fraud_risk` (Mercado Pago decides when to ask, as it
  recommends) and `liability_shift: required` (a chargeback on an
  authenticated payment falls on the card network, not the store).
- A pending attempt keeps the challenge URL (`payments.challenge_url`) and a
  40-minute deadline (`expires_at`, also what keeps the unpaid order alive);
  both leave the public payment once it settles.
- The order page shows the bank's page in an iframe. When it posts
  `{ status: "COMPLETE" }` (only messages from that frame count) or the
  payer taps "Já confirmei", the page calls
  `POST /public/orders/:token/payments/sync`, which reads the attempt from
  the gateway (a few tries, since the result may lag) instead of waiting for
  the webhook. The webhook still settles it on its own.
- A refused challenge (`cc_rejected_3ds_challenge`) is a rejected attempt
  with its own message; the order can be paid again.

## Consequences

- Some card payments take an extra step for the payer, decided by Mercado
  Pago's risk analysis, in exchange for fewer chargebacks on the store.
- The challenge can't be exercised against Mercado Pago in the tests: the
  e2e plays back the API's answers and a fake bank page; manual testing uses
  the sandbox cardholder names `APRO-CHOK` / `OTHE-CHNO`.
