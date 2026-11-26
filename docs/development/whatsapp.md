# WhatsApp Cloud API (ADR 0025)

Each store connects its own WhatsApp number in the store page (tab
"WhatsApp") through Meta's Embedded Signup of the platform's Tech Provider
app. The store pays Meta for what it sends; the platform pays nothing.

## What the platform configures once (Meta App Dashboard)

The app already has advanced access to `whatsapp_business_management`,
`whatsapp_business_messaging` and `business_management`, and is live.

1. **Facebook Login for Business → Configurations**: create one from the
   "WhatsApp Embedded Signup" template (enable the WhatsApp Business app
   onboarding if stores should keep using the app on their phone:
   coexistence). Its id is `WHATSAPP_CONFIG_ID`.
2. **Facebook Login for Business → Settings**: Client OAuth login, Web OAuth
   login, Enforce HTTPS, Login with the JavaScript SDK on; the web's domain
   in "Allowed domains for the JavaScript SDK" and in the valid OAuth
   redirect URIs. Without it the popup opens but the page never gets the
   result.
3. **App settings → Basic**: App ID (`WHATSAPP_APP_ID`) and App secret
   (`WHATSAPP_APP_SECRET`).
4. **Webhooks**: leave the app's own callback alone (another product uses
   it). The API sets an override on every WABA it connects, pointing to
   `<APP_URL>/api/v1/webhooks/whatsapp` (or `WHATSAPP_WEBHOOK_URL`), checked
   by Meta with `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (any long random string).
   Make sure the app is subscribed to the `messages` field of the WhatsApp
   Business Account product.

```env
WHATSAPP_APP_ID=
WHATSAPP_APP_SECRET=
WHATSAPP_CONFIG_ID=
WHATSAPP_GRAPH_VERSION=v24.0
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
```

WhatsApp stays off (the tab says so) while any of the first four is empty.

## What can't be overridden

Template review (`message_template_status_update`) and account events
(`account_update`) always go to the app's default callback, so they never
reach us. The API polls the templates instead (`SyncWhatsAppTemplates`, every
15 minutes while any is pending; "Atualizar" in the tab does it now) and
learns about a revoked token (error 190) or a missing payment method (error
131042) from the answers to its own calls.

## Development

`WHATSAPP_FAKE=true` (never in production): "Conectar número de teste"
connects without Meta, our templates read as approved, messages are only
logged. The e2e run uses it, with two hooks: `GET /api/v1/__e2e/whatsapp/login-code?phone=`
and `POST /api/v1/__e2e/whatsapp/inbound` (a customer's message).

To try the real thing locally, expose the API with a tunnel and set
`WHATSAPP_WEBHOOK_URL` to it; Meta must reach the override to accept it.

## Test numbers and numbers the platform manages

Meta's test number (or any number of a WABA the platform's business
already manages) is connected without Embedded Signup, with a token that
has the WhatsApp permissions on that WABA (a system user's):

```sh
cd apps/api
node ace whatsapp:connect --store=<slug> --waba=<WABA_ID> --phone=<PHONE_NUMBER_ID> --skip-register
```

The token is asked without echo. The command does what the panel does:
override, templates submitted, review polled.

After the API's domain or the verify token changes, point every connected
WABA to it again:

```sh
node ace whatsapp:webhook            # every store
node ace whatsapp:webhook --store=jj # one
```

## Costs (Meta, charged to the store)

Per delivered template message, by category and country. Utility (order
notices) and authentication (login codes) are charged; since October 2026
utility is charged inside the customer service window too. Messages
customers send us cost nothing, and the reply to "Entrar pelo WhatsApp"
is a service message (1,000 free per number per month). Without a payment
method in WhatsApp Manager, Meta refuses the templates (131042): the tab
shows it until a message is delivered again.
