# 0025. WhatsApp Cloud API per store: order notices and phone-verified history

- Status: Accepted (supersedes 0014)
- Date: 2026-11-26

## Context

Customers of online orders only learn about their order on its tracking
page (or by web push, where the browser supports it). They also want to see
their past orders on another phone. ADR 0014 solved that with a device token
shared through a link ("Usar em outro aparelho"), which nobody understood and
which loses the history with the last device. It said a verified phone (OTP
by SMS/WhatsApp) could replace it later.

The platform owner already runs a verified Meta **Tech Provider** app
(business portfolio "Cero Imagem") with advanced access to
`whatsapp_business_management`, `whatsapp_business_messaging` and
`business_management`. That app is live and its default webhook callback is
used by another product (Chatwoot), so this system can't take it over.

Online orders are few (8 of ~910 in production when this was written), so
the cost per message matters little; who pays it does.

## Decision

- **Each store connects its own number** through Embedded Signup (v4) of
  that app: the manager finishes Meta's flow in the store page, the browser
  sends the `code`, `waba_id` and `phone_number_id` to
  `POST /stores/:id/whatsapp`, and the API exchanges the code for the
  business's token (`GET /oauth/access_token`, server to server), registers
  the number (`/register` with a random PIN kept encrypted; skipped for a
  WhatsApp Business app number, "coexistence", told by the signup's event or
  the number's `is_on_biz_app`) and subscribes the app to the WABA. The
  panel asks for coexistence (`featureType`), and a coexistence onboarding
  is followed by Meta's one-time sync of the app's contacts and history
  (`SyncWhatsAppBusinessApp`, within 24 hours). **The store pays Meta** with its own payment method; a Tech Provider
  can't lend a credit line. App id, secret and the Facebook Login for Business
  configuration come from the env (`WHATSAPP_*`).
- **Webhook override, never the app's callback.** The API subscribes the app
  to every WABA it connects with `override_callback_uri` =
  `<APP_URL>/api/v1/webhooks/whatsapp` and the env's verify token. One
  endpoint for every store (and for test numbers, connected with
  `node ace whatsapp:connect`); events are routed by
  `metadata.phone_number_id`. `node ace whatsapp:webhook` applies it again
  (after a domain change). Payloads are trusted only with a valid
  `X-Hub-Signature-256` (HMAC-SHA256 of the raw body with the app secret).
- **What can't be overridden is polled.** Template status and account
  events always go to the app's default callback (Chatwoot's). Template
  status is read with `GET /<WABA_ID>/message_templates` (job
  `SyncWhatsAppTemplates`, again a few times while any is pending, and on
  "Atualizar" in the panel). A token that stops working (error 190) marks
  the connection broken; a payment problem (131042) marks it in the panel
  until a message gets through.
- **Templates are ours, created in each WABA** (prefix `rm_`, version
  suffix: a changed text is a new template), utility, pt_BR, named body
  parameters, in the tone of the delivery apps customers know: "recebido"
  carries the order (items on one line, payment, total, pickup time) and no
  link; "em preparo" carries the "Acompanhar pedido" link; "pronto",
  "retirado" and "cancelado" are plain text (`rm_pedido_recebido_v2`,
  `rm_pedido_preparo_v1`, `rm_pedido_pronto_v2`, `rm_pedido_retirado_v1`,
  `rm_pedido_cancelado_v2`). Each store turns each notice on or off
  ("retirado" starts off: every message is paid). Authentication with a
  copy-code button: `rm_codigo_acesso_v1`.
- **Order notices are opt-in per order** (`orders.whatsapp_opt_in`, a
  checkbox at checkout, offered only when the store's notices can go out).
  Online orders only. Every notice is a `whatsapp_messages` row with a
  unique `dedup_key` (each step once, ready once per `ready_at`, cancelled
  only after "recebido" was told), then a `SendWhatsAppMessage` job; status
  webhooks update the row.
- **History needs a verified phone**, per store, two ways:
  - *Message* (default, free): the menu shows a code and opens
    `wa.me/<store number>?text=…<code>`; the customer's message arrives on
    the webhook from their number, which proves it. The page polls the
    challenge and gets a session. Inbound messages cost nothing; the reply
    ("pronto, volte ao cardápio") is a service message.
  - *Code*: the customer types the phone and gets the authentication
    template (paid by the store). 6 digits, HMAC with APP_KEY, 10 minutes,
    5 attempts, 3 sends per phone per 15 minutes.
  A verified phone opens `customer_sessions` (random token, only its
  SHA-256 kept, 90 days renewed by use), sent as `Customer-Token`. The
  history lists the store's orders of that phone (counter orders too: the
  phone is proven now), matching both spellings of a Brazilian mobile
  (WhatsApp ids of older numbers lack the ninth digit).
- **The ADR 0014 token is gone**: placing an order no longer issues one, the
  `vincular` link and "Usar em outro aparelho" are removed, and so are
  `customers.access_token_hash` / `history_since`. A device still follows
  the orders it placed by their public tokens, without signing in.
- **Development and tests** use `FakeWhatsAppClient` (`WHATSAPP_FAKE`,
  never in production): connecting accepts any code, templates are approved
  at once and messages are only logged. e2e hooks simulate an inbound
  message and read the last code sent.

## Alternatives considered

- **One platform number for every store**: simplest, but the platform pays
  every message and customers talk to "React Menu", not to their shop.
- **Using the app's default callback**: taken by Chatwoot; an override per
  WABA leaves it untouched.
- **OTP by authentication template only**: familiar, but each code costs the
  store money and needs the template approved first; kept as the second way.
- **Keeping the device token next to the phone login**: two ways to the same
  thing, and the shared link stays a bearer secret people forward.

## Consequences

- Stores without WhatsApp keep only the per-device list of orders.
- A customer who uses a WhatsApp username and hides the number can't sign in
  by message (the webhook has no `from`); the code way still works.
- Template approval and account bans aren't pushed to us; the panel shows
  what the last poll saw.
- Meta changes these APIs often: the Graph version is `WHATSAPP_GRAPH_VERSION`.
- Tests: `apps/api/tests/functional/whatsapp_*.spec.ts`,
  `customer_history.spec.ts`, `apps/web/e2e/order-history.spec.ts`.
