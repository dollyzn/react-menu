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

## Coexistence (the store's WhatsApp Business app number)

The panel asks Embedded Signup for it (`featureType:
"whatsapp_business_app_onboarding"`, `sessionInfoVersion: "3"`), so Meta's
window offers the store's WhatsApp Business app number next to a new one.
The number keeps working on the phone. What happens:

- The window's event is `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`, often
  with only `waba_id`: the API takes that account's only number, and never
  calls `/register` (Meta forbids it). The API also reads `is_on_biz_app`
  from the number, so the code-only path can't register it by mistake.
- Within 24 hours Meta requires the app's contacts and then its chat
  history to be synced (`POST /<number>/smb_app_data`, `smb_app_state_sync`
  then `history`, each **once**). The `SyncWhatsAppBusinessApp` job does it
  right after connecting; the tab shows its state. Missed or refused: the
  store must disconnect and connect again.
- Disconnecting only unsubscribes the app; a coexistence number is never
  deregistered.

Requirements on the store's side: WhatsApp Business app 2.24.17 or newer;
connected devices are logged out during onboarding (up to 4 afterwards,
not WhatsApp for Windows or WearOS); 20 messages/s; broadcast lists turn
read-only and disappearing, view-once and live location messages are off
in 1:1 chats; groups aren't synced.

Meta's webhook topics for it (`history`, `smb_app_state_sync`,
`smb_message_echoes`, `account_update`) are subscribed **per app** in
App Dashboard > WhatsApp > Configuration: turning them on also sends them
to the app's default callback, which belongs to another product. The API
only logs the ones that reach our override; nothing depends on them. Not
confirmed by Meta's pages: whether a v4 configuration still offers a new
number in the same window (check it in WhatsApp > Embedded Signup Builder >
"Check a launch config").

## Diagnosing a connection

Embedded Signup ends with a code (the SDK's callback) and, normally, a
window message naming the WABA and number. When that message doesn't reach
the page, the panel sends the code alone after 8 s and the API finds them
from the token. Which way it went:

- **Grafana (Loki)**: `{service_name="react-menu-api"} |= "WhatsApp connected"`.
  Each connection logs `via`: `window_message`, `token_discovery` or
  `command` (`whatsapp:connect`), with the store, WABA and number. A refusal
  logs "WhatsApp (Meta) refused a request" with Meta's `code`, `reason` and
  `fbtraceId` (quote it to Meta's support).
- **The browser**, while connecting: DevTools → Network → the `POST
  …/whatsapp` request. A body with `wabaId` and `phoneNumberId` came from the
  window message; only `code`, from the token. To see Meta's messages
  themselves, run this in the console before clicking "Conectar WhatsApp":

  ```js
  addEventListener("message", (e) => e.origin.endsWith("facebook.com") && console.log(e.origin, e.data))
  ```

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
