# apps/web (Next.js 16)

Read the root `AGENTS.md` first. This file only covers the web app.

## Where things go

| Concern | Location |
| --- | --- |
| Admin routes | `app/app/(dashboard)/stores/[store]/<domain>/` (page + `components/`); `(dashboard)/layout.tsx` holds the shell; `(dashboard)/settings` |
| Panel shell | `components/app/layout/`: `app-sidebar` (store switcher, groups from `lib/menu-itens.ts`, account menu), `app-header` (breadcrumbs from the route, notifications), `page-header`. The bell is `components/app/notifications/notifications-popover.tsx` (filter chips Todas / Não lidas / Pedidos / Lojas / Sistema, day groups, a tile per category, hover/focus actions that stay visible on touch screens, this device's push in the footer, a link to the preferences) |
| Store team | `…/members` (`member-row.tsx`: photo via `avatarUrl`, online dot and "Visto há…", badges for invite pending/expired, access off, e-mail not verified; actions menu: switch access off/on, end sessions, remove; the list refreshes every 30 s), add dialog (name, then e-mail, role); invites land on `/app/reset-password?invite=1`. "Online" comes from `components/app/presence-heartbeat.tsx` in the dashboard layout (`GET /auth/presence` a minute while the tab is visible) |
| Operations | Kitchen (`…/kitchen`): the queue card grows into "Fazer agora" (shared `layoutId`) only on screens ≥1024px, where both are side by side, with no fade on top (the content rides along with `layout`, so the text isn't stretched; the finished card and the handed-over queue card leave at once); phones fade in instead; the page is `relative overflow-x-clip` (popLayout positions the leaving card absolutely, so the clip only reaches it when the page is its containing block), so a card flying off or growing never makes the page scroll; after "Fiz 1" (`SwipeCard staysAfter`) the card slides back from the side it left by, after "Fiz todos" it stays gone; reduced motion is respected; no `backdrop-blur` inside the swipe card (costly while dragging on phones). `…/orders` (board; "Entregar" is `orders/deliver-order-button.tsx`: orders are normally paid at the POS and only go; an unpaid one ("receber depois", online "pagar na retirada") is received first in `components/app/payments/receive-payment-dialog.tsx` (amount on top, Maquininha / Dinheiro / Pix / Crédito / Débito, `cash-change.tsx` with the change and common notes; the Point dialog delivers when its approval is closed), the same dialog as the card menu's and the detail's "Receber pagamento" (`orders/receive-payment.tsx`); items that skip the kitchen (`requiresPreparation: false`, drinks) are listed to check; a paid order with such items asks "Separou tudo?". The card's title is the number and, as big, the customer's name (the counter calls people by name); lines show `lineName(line)` (`lib/order-line.ts`: `displayName ?? name`, "Pastel de Frango com Catupiry", see the API's choice groups; every staff screen uses it, the history too) through `orders/order-lines.tsx`. Attendants get today's board only: no "Histórico" tab, no order detail sheet, no "Concluídos e cancelados hoje" (it sums the sales), no cancelling (only "Descartar pedido" on a POS order held for the card machine with nothing paid); instead `orders/recent-deliveries.tsx` ("Últimos entregues") lists the last 3 handed over, with items, drinks and notes but no amounts, to check what went out; the API refuses them the history, other days and `/cancel` (cancelling refunds a paid order)), `…/pos` (POS; the ticket is kept per store in localStorage (`lib/pos-ticket-storage.ts`, 12 h; restored after hydration through `rebuildLine` (item-detail.tsx: today's prices, picks that still fit; lines that can't be sold are left out and the toast says how many); never in add mode, and a kept ticket waits aside while another is on screen; gone once sent or cleared, and on sign-out: `clearSavedTickets`); a ticket line's description opens it in `ItemCustomizer` with its picks, notes and quantity (`initial`, through `restorePicks`: only options still offered, on sale and within their group's maximum; "Salvar" replaces it in place, and joins it with an identical line; its own units don't count against the stock; one `picking` state with a `session` per opening, cleared only by closing); the ticket sends the order already paid: "Enviar e cobrar na maquininha" (with a machine on), or Dinheiro / Pix / Crédito / Débito (`counterMethod`), each confirmed in the receive dialog with it chosen (the method can't change once sent; cash shows the change), or "Enviar e receber depois" (the exception), which asks when in `components/app/payments/send-unpaid-dialog.tsx` (react-hook-form + zod): "Receber na retirada" (goes from the ticket, as before) or "Pagar depois (fiado)" with who to charge (name and phone, required; the name suggests the store's customers like the ticket: `components/app/customers/customer-autocomplete.tsx`, shared, `inline` in dialogs; the order goes with `payLater`; a replay of an earlier send of the same ticket is turned into fiado with `markPayLater`); the card shows "Pagar depois" and "Entregar" hands it over without receiving; the card's menu turns an unpaid order into one (the same dialog, fiado only); managers follow them in the board's "Pagar depois" tab: the summary (`GET /orders/pay-later/summary`: count for the tab, total, how many customers and since when) and two views (`?lista=`): by customer, the default (`orders/pay-later-customers.tsx`, `GET /orders/pay-later/customers`: a card per customer with what they owe, their orders to tick (Base UI `Checkbox`, "Selecionar todos" with the dash of `indeterminate`, a local change to `components/ui/checkbox.tsx`), "Receber tudo" or "Receber N", call and WhatsApp with the charge written; one order goes through `ReceivePayment` (card machine included), several through `ReceivePaymentDialog` without the machine and `POST /orders/pay-later/receive`; search debounced, sort, pages of 12), or by order, the store's DataTable (`orders/pay-later-list.tsx` + `pay-later-columns.tsx`: cards by default, search/sort/pages on the API and in the URL via `useTableQuery`, call/WhatsApp and "Receber" per order); its own cache tag `pay-later-<store>`, refreshed by the realtime order events; with a card machine on, "Enviar e cobrar na maquininha" opens `components/app/point/point-charge-dialog.tsx` on the ticket (`prepare`: the order is created only when the charge is sent; the dialog is `ResponsiveModal dismissible={false}`, closed only by its buttons): credit/debit/Pix as the store allows (always one of them: the machine is told how to charge, so the store's limits hold), installments, which machine, then follows the charge (poll 2 s, Mercado Pago check every 10 s) until approved, refused or cancelled; closing it loses nothing: `components/app/point/pending-charges-bar.tsx` ("Na maquininha", on the POS and the orders board) lists the waiting charges and opens them again (`resume`), and a busy machine (`E_TERMINAL_BUSY`) offers to cancel the other order's charge; cancelling one already on the machine (`E_CANCEL_ON_TERMINAL`) turns the dialog into "cancele por lá" without the button, and it follows the charge until the machine reports it; the order card's menu has "Receber pagamento" (the card machine is one of its methods) for unpaid orders, and "Adicionar itens" while the order is in the queue: it opens the POS on `?pedido=<id>` (the order read from today's board), whose ticket then adds to it ("Adicionando ao pedido #12", "Adicionar pago em" / "Adicionar e cobrar na maquininha" / "Adicionar e receber depois", `useAddOrderItemsMutation` with a stable key; if the kitchen started meanwhile, a toast offers "Pedido novo" with the ticket kept); paid now or on the machine, an addition takes all that is due (the dialog says "inclui R$ X que faltava" and sends the `amount` shown; 409 `E_AMOUNT_CHANGED` refreshes the board), and after the machine path the POS leaves add mode; a partly paid order shows "Falta receber R$ X" and the receive dialog (which sends the `amount` it shows) and the machine take only `amountDue`; the detail lists the receipts and marks added lines; setup in the store page's `point-settings-card.tsx` ("Cozinha só depois do pagamento": the ticket's button reads "Cobrar na maquininha e enviar", the order is created with `payOnMachine` and the API holds it in `pending_payment`; the dialog tells it from the created order's `status`; the board puts held POS orders first in "Na fila", amber with a dashed border and "Aguardando pagamento · ainda não foi para a cozinha", with "Receber pagamento" and, for attendants too, "Descartar pedido"); `redux/features/point/pointApi.ts`), `…/kitchen` (KDS; add-ons by group from the API's `addonGroups`: the group once as a small label, each pick on a neutral chip; "Próximos" keeps the full labels), `…/inventory` (stock dialog with quick amounts for units) |
| Store page (managers) | `stores/[store]/page.tsx`: the store at a glance on top (banner and logo with their upload dialogs, name, status, "Copiar link" / "Ver cardápio") and tabs kept in the URL (`?aba=`, `hooks/use-query-param.ts`; panels `keepMounted`, so a half-edited form survives a tab switch): Perfil (`components/store-profile-form.tsx`, the basic information edited in place), Cardápio (`components/menu-order.tsx`: categories and the selected category's products side by side from `lg`, one at a time on phones, drag handles from `sortable-list.tsx`), Funcionamento (`store-operation-card.tsx`: pickup time, paying at the counter, stock, kitchen batching; `opening-hours-card.tsx`), Pagamentos (`payment-settings-card.tsx`, `point-settings-card.tsx`). Both forms save through `components/use-save-store.ts`, which also updates the session's copy of the store (sidebar, breadcrumbs) |
| Choice groups | panel `stores/[store]/option-groups/` (paginated `DataTable` with `renderCard`, dialog with `NumberStepper` for min/max, `groupRule` for the "Obrigatório · escolha 1" text), each option can have its own price in the group ("Mesmo preço para todas" + per-option `MoneyInput`, undo = the add-on's price), or the group prices by pick order ("Preço pela ordem da escolha": one price per pick up to the maximum, `pickPrices`; `lib/choice-pricing.ts` mirrors the API: picks priced in the order chosen, the option shows the next pick's price, "Pedir de novo" re-prices with `repriceByPick`), "Palavra do item trocada pela escolha" (`replacesInName`, e.g. "Queijo") renames the item on the kitchen and the board; items pick them in their dialogs (`optionGroupIds`); `ItemCustomizer` (menu and POS) renders radios (max 1), capped checkboxes, or −/+ per option when the group `allowRepeat`s (picks keep repeats; `addonLabels` in `lib/addon-label.ts` prints "2× Queijo"), keeps required groups open and optional ones collapsed (the header shows the pick), and blocks "Adicionar" until required groups are filled. Bag/ticket add-ons carry `groupId`/`groupName` (`redux/slices/cart.ts`: `lineAddonsInput` builds `addonIds` + `choices`; `lib/addon-label.ts` prints "Recheio extra: Carne"); "Pedir de novo" puts group picks back in their group by name and skips items whose required choice is gone |
| Overview and reports (managers) | `…/overview` (today, live: `GET /dashboard/today`, refreshed by the store's realtime `Order` tag and a 1-min poll; pace vs the same weekday last week, queue, visits/conversion, stock and menu alerts), `…/reports` (`GET /reports/sales`; period in the URL `?de=&ate=` via `PeriodFilter` on the tables' `DateRangePicker`, `lib/report-period.ts` in BUSINESS_TIMEZONE; CSV with `lib/csv.ts`). Shared: `components/app/stat-tile.tsx` (`StatTile`, `Delta`, `Sparkline`), `components/app/ranked-list.tsx`. Charts: one series in `--primary` (validated in both themes), no legend for one series, a `sr-only` table under each chart |
| Opening hours | panel card `stores/[store]/components/opening-hours-card.tsx` (table Dia / Disponibilidade / Horas: "O dia todo" = 00:00–23:59, 30-min `TimeSelect`s), schedule-aware `store-status-dropdown.tsx`; menu hero/banner text and the "Horários" modal (`(menu)/_components/store-hours.tsx`, today highlighted after hydration; `lib/opening-hours.ts`: `formatWhen`, `dayHours`), `MenuView` refreshes itself when the store opens or closes |
| Stock limits in the menu and POS | `lib/stock.ts` (`unitsLeft`, `stockHint`: "Restam N" from `stockLeft`); `ItemCustomizer` caps the quantity (bag/ticket included); the API is authoritative |
| Auth pages | `app/app/(auth)/`; "Entrar com Google" (`login/components/social-login.tsx`, shown when `GET /auth/social/providers` lists it) opens `/app/social` in a popup (520×760, room for Google's consent without scrolling) that reports over a BroadcastChannel (`lib/social-auth.ts`), full page when popups are blocked or in the installed app. The popup can't be watched (Google's COOP makes it read as closed), so while it is open the e-mail form is locked and "Cancelar" or a 5-min timeout frees it; the page keeps listening, so a sign-in finished after "Cancelar" still enters |
| Settings (own account) | `(dashboard)/settings/page.tsx` in sections Conta / Segurança / Notificações (`#notificacoes`) / Preferências; `settings/components/`: `notification-preferences-card.tsx` (this device's push; push/e-mail switches per type grouped by category; mute per store; the managers' daily summary with its hour; every change saves at once with an optimistic update), `profile-card.tsx` (photo cropped square ≤512px via `compressImage(file, { maxSide, square })`, name, stores), `password-card.tsx`, `sessions-card.tsx` (device icon, "Este dispositivo", `timeAgo` from `lib/relative-time.ts`, revoke one or all others); `redux/features/account/accountApi.ts` (profile/photo writes put the returned user in the session); avatars everywhere through `lib/avatar.ts` (`avatarUrl`: the photo or a DiceBear one seeded by the name) |
| Two-factor sign-in | login: `login()` answers `{ twoFactor }` and `(auth)/login/components/two-factor-step.tsx` takes the code (e-mail or app; recovery code; "Confiar neste dispositivo"); Google's popup reports `{ type: "two-factor" }` (full page: `/app/login?etapa=codigo`) and the page reads the pending challenge (`GET /auth/two-factor`). The login page also asks by itself when it opens and whenever it comes back (`GET /auth/two-factor?ifAny=1`, `useLazyPendingTwoFactorQuery`; only within 10 min of "Entrar com Google" on this device, `lib/pending-sign-in.ts`, so a step left by someone else on a shared device isn't shown; not while a step is on screen): the installed staff app (scope `/app/`) sends Google, through the API outside its scope, to a browser tab and can reopen on its start page without `?etapa`, with the code already sent. A step turned down with "Voltar para o login" doesn't come back in that tab (`sessionStorage`, memory when blocked). `components/app/auth/code-input.tsx` (`CodeInput`): shadcn `input-otp` with animated slots, shake on error, paste keeps only digits. Settings: `settings/components/two-factor/` (card, setup dialog with QR via `qrcode.react` + key, recovery codes copy/download; the dialog stays mounted while enabling flips the card). `components/app/two-factor-prompt.tsx`: sidebar invitation (card when open, shield with a dot when collapsed), "Agora não" rests 7 days (`lib/two-factor-prompt-storage.ts`). e2e: `login()`/`apiSignIn()` in `e2e/fixtures.ts` read the code from the API's e2e hook |
| Legal pages | `app/(legal)/privacy`, `app/(legal)/terms` (linked from the login and the menu footer) |
| SEO | `app/robots.ts` (panel, orders and API disallowed), `app/sitemap.ts` (stores from `GET /public/stores`); per store: `_lib/store-seo.ts` (title, ≈160-char description that always keeps the call to action, canonical: the default store's `/<slug>` → `/`, Open Graph/Twitter), `(menu)/opengraph-image.tsx` + `[slug]/opengraph-image.tsx` (`_lib/store-og-image.tsx`: banner, logo, name in Geist from `public/fonts`; Satori has no `inset`), `_components/store-json-ld.tsx` (schema.org Restaurant + Menu with BRL prices). The panel and order pages are `noindex` |
| Item photo | `components/app/photo-field.tsx` (`PhotoField`: drop, paste, pick or camera; previews the 16:10 detail and the list thumbnail; staged as `PhotoChange` until the form saves, "Desfazer" goes back), `lib/image-compress.ts` (≤1600px WebP/JPEG, applies orientation, drops EXIF), saved after the item by `items/components/use-save-item-photo.ts` (`uploadItemPhoto` / `removeItemPhoto`). Add-ons use the same `PhotoField` in their create/edit dialogs (`addons/components/use-save-addon-photo.ts`, after the add-on is saved); the menu and the POS show an option's photo next to it (`OptionPhoto` in `item-detail.tsx`, only when it has one) |
| Bulk edit of items/add-ons | `components/app/bulk-edit-dialog.tsx` (from the table's selection, preview before saving), math in `lib/bulk-pricing.ts` (sends absolute values); tables that act on selections pass `getRowId` |
| Login marquee | `public/login-marquee/*.webp`, regenerated by `e2e/marquee-screenshots.spec.ts` (`CAPTURE_MARQUEE=1`) |
| Customer menu (SSR) | `app/(menu)/` (`/`, `/[slug]`, `/pedidos`, `/pedido/[token]`), shared parts in `_components/`, helpers in `_lib/`. Mostly used on phones: no confirmation toasts there (they cover the bag bar); confirm on the control itself (the bag count bumps, `hooks/use-copied.ts` turns a copy button into "Copiado!", the stock limit shows on the bag line). Toasts stay for errors and for news the screen doesn't show (items left out of "Pedir de novo", an expired device link). "Avisar quando ficar pronto" on `/pedido/[token]` is `_lib/use-ready-alert.ts`: the tap unlocks audio and, where web push works (`lib/web-push.ts`, shared with the panel's `notification-provider`), subscribes this browser to the order (`POST /public/orders/:token/push`): mode `push`, told even with the phone locked; otherwise mode `page` (chime, vibration, title flash and a local notification while the page is open). The mode is kept per order in localStorage (`ready-alert:<token>`: push, page or off, read after hydration); once push worked, `ready-alert:always` makes the next orders on this device subscribe by themselves (permission already granted, no prompt). It is per device, never per customer: phone numbers aren't verified, and tying it to one would let anyone follow someone else's orders. "Não avisar" turns it off for that order and the next ones. With push the page doesn't show its own notification (same tag `order-ready-<token>`). Permission is asked right in the tap, before any await (Safari shows the prompt only during the gesture); after a reload the first touch anywhere unlocks the chime. Firebase keeps a single `onRegistered` handler: listen through `listenForFid` (`lib/web-push.ts`), never `onRegistered` directly, or the panel's and the order's listeners replace each other. `public/sw.js` skips a push only where a focused tab already shows it (any `/app/` page for staff, the order's own page for customers) |
| Checkout payment methods | `_lib/payment-methods.ts` (labels, `cardRejection`), `_components/payment-panel.tsx` (Pix, card) and `card-payment-form.tsx` (Card Payment Brick, loaded on demand; the SDK rebuilds the Brick when `initialization`, `customization` or a callback changes identity, so they are memoized and the callbacks read the latest props from a ref; colors from the app's tokens via `lib/mercado-pago-style.ts`, always the Brick's `default` theme with our variables; the font list ends in Arial for the card fields in Mercado Pago's iframes); with a card fee passed on (`checkout.cardFees`, ADR 0022), `CardPayment` asks Crédito / Débito first, shows order + fee + total (`lib/card-fee.ts` mirrors the API's rounding), restricts the Brick to that type (`paymentType`) and sends `amount`; the bag's "Cartão" option shows the rates (`store.cardFees`); the store's "Taxa do cartão" card is `stores/[store]/components/card-fee-card.tsx` (Pagamentos tab); 3-D Secure in `card-challenge.tsx` (the bank's page in an iframe; its `COMPLETE` message or "Já confirmei" calls `syncPayment`; ADR 0018) |
| Customer history and device link | `_lib/customer-orders.ts`, `_components/order-history.tsx`, `customer.tokens` (ADR 0014) |
| Bag and customer identity | `redux/slices/cart.ts`, `redux/slices/customer.ts` (persisted) |
| Sidebar by role | `lib/menu-itens.ts` (`getManageMenuGroups`, `homeForRole`); new store sections also need a label in `app-breadcrumbs.tsx` |
| Route guard (UX only) and CSP | `proxy.ts` (checks the auth cookie exists; without it, `/app/login?next=<path>`, and every sign-in path (password, code, Google popup or page) goes back there via `lib/return-to.ts` (panel paths only, never the auth pages: going back to /app/logout would sign out again; logout forgets a kept target). Signing in enters with `enterPanel()` (`lib/enter-panel.ts`) and the sign-out goes to the login with `redirectToLogin()`: full page loads, since the router would reuse what it fetched before (a panel page redirected to the login, so the login stayed on screen until F5); without a target it goes straight to the first store, so the store list's generic install manifest isn't left next to the store's. The login page asks the API for the social providers on the server, so "Entrar com Google" is in the first render. The session cookie is SameSite=Lax (ADR 0019), so a link from another site (an e-mail, the installed app's launch) arrives signed in; should one still land on the login, it moves on when `useSession().confirmedUser` (asked to the API on this page load, never the remembered user) is set. `/app/logout` signs out at once only when the panel's own "Sair" asked (`redirectToLogout` → `lib/logout-intent.ts`, a mark in the page's memory); opened any other way it asks "Sair da conta?"; sets `Content-Security-Policy-Report-Only` from `lib/csp.ts` with a per-request nonce in `x-nonce`, which Next and the root layout put on scripts: inline scripts take `nonce`; violations are logged by `app/csp-report/route.ts`). A new third-party script, frame, API or image host needs `lib/csp.ts`. Scanner paths (`.php`, `.env`, dotfiles but `/.well-known/`, `/wp-admin`, `/phpmyadmin`…: `PROBE`) get a bare 404 there, before any page or API call; the API refuses those (and the web's own root paths) as store slugs |
| Store assistant (ADR 0023) | `components/app/assistant/` on shadcn's AI Elements patterns (Base UI): `assistant-panel.tsx` (header button + Ctrl/⌘ J, side `Sheet` with `keepMounted` (a local prop in `components/ui/sheet.tsx`) so closing keeps the chat; the last conversation, model and effort persist in `localStorage` per person and store (`readAssistantPrefs("<userId>:<storeId>")`: the next person on a shared device never gets the last one's conversation; a conversation that can't be opened just starts a new one, quietly), history menu, "Nova conversa", the off state for managers/attendants), `assistant-chat.tsx` (`useChat` with a `DefaultChatTransport` that sends only the newest message, effort and screen; `lastAssistantMessageIsCompleteWithApprovalResponses`; Chat on `MessageScroller`, suggestions, errors), `assistant-message.tsx` (`Message`/`Bubble`; steps in a Chain of Thought ("Pensou por 4s · 3 passos", thoughts titled by their bold heading and timed from `metadata.reasoningMs`, tool lines that open into `tool-call.tsx`: parameters in pt-BR and the raw answer in a `CodeBlock`); text with Streamdown), `tool-cards.tsx` (a card per tool output), `approval-card.tsx` (Confirmation: `Item` with the preview and Recusar/Aprovar; new menu items fold by category, the first open, name and price on a line and the description under it, never wider than the sheet; only the newest reply's cards ask, older ones read "Ficou sem resposta" as the API declined them, and an approved change that failed shows its error); "Gerar de novo"/"Tentar de novo" are hidden after a change went through; after an answer that changed data the panel's Store/Item/Category/Ingredient/Order tags refetch (`panelTagsAfterWrite`); settings saves write the result into the store cache at once (`onQueryStarted`), so quick successive changes build on each other; deleting a conversation asks first; on touch screens Enter is a new line, `prompt-input.tsx` (photos via `compressImage`, shown with `photo-attachment.tsx`: thumbnail, name, format and size, a tap opens the photo whole in a dialog, also in the sent message; "Preparando a foto…" while it shrinks; the strip has room around it so the focus ring isn't clipped by its scroll; Model Selector: the store's models and "Rápido/Detalhado"; Context: the conversation's window and tokens plus the store's messages today, in a `Popover` that opens on hover or tap). Types and labels in `lib/assistant.ts`; `redux/features/assistant/assistantApi.ts`. The chat stream itself is the one call outside RTK Query (the AI SDK reads it). Store page tab "Assistente": `assistant-settings-card.tsx` (providers connected with a tested key, the chat's models with the default, added from a `Command` list of recommended and each key's own models, today's usage, the cost estimate in US$ with an editable price per model; every change saves at once; provider logos in `provider-logo.tsx`, from @lobehub/icons (MIT)). `MODEL_SUGGESTIONS` lists current models (checked 2026-11-19). New `components/ui` files (message-scroller, message, bubble, trace, attachment, collapsible, code-block + `hooks/use-highlighted-code.ts` + `lib/highlighter.tsx` on shiki) came from the registry by hand: the CLI would add the `cn` package |
| Server state | RTK Query: `redux/api/baseApi.ts`, `redux/features/<domain>/<domain>Api.ts` |
| Server-side API calls (SSR, metadata, icons) | `lib/server-api.ts`: `serverApiBase()` (internal URL in Docker) and `visitorHeaders()` (forwards the visitor's IP so the API's per-IP limit counts them, not the server). `fetchMenu` doesn't ask the API for a slug outside `STORE_SLUG` (`utils/string.ts`, shared with the store dialogs; not found), reads the bodies it doesn't use (never `cancel()`: Next tees the response), and a 429 from it redirects to `app/muitos-acessos/route.ts` (a real 429 with Retry-After and a plain page that goes back by itself: pages can only answer 404/403/401) |
| Panel shortcut on customer pages | `app/(menu)/_components/panel-shortcut.tsx` (staff signed in on the device; after rehydration) |
| Session / push | `contexts/session-provider.tsx`, `contexts/notification-provider.tsx` |
| Phone bar color (`theme-color`) | the page's background per theme (`lib/theme-colors.ts`); `components/app/theme-color-sync.tsx` (root layout) makes every `theme-color` tag follow the theme chosen on the site, not the system's (it reapplies when Next rewrites the head) |
| PWA (manifests, service worker, install prompt) | `app/manifest.ts` (default store), `app/(menu)/[slug]/manifest.webmanifest/` (other stores), `app/app/manifest.webmanifest/` (`?store=` from a store's panel), all via `customerManifest`/`lib/pwa-manifest.ts`; `public/sw.js`, `components/app/pwa/`, `hooks/use-pwa-install.ts` (ADR 0012) |
| Store icons (favicon, PWA) | `app/icons/store/[slug]/[file]/route.ts` renders the logo (sharp, on a white tile; no logo → the app's icons); URLs and metadata in `lib/store-icons.ts`, used by the menu pages (`_lib/store-metadata.ts`) and the store's panel layout |
| Realtime | `lib/transmit.ts`, `hooks/use-store-realtime.ts` (`stock.changed`/`menu.changed`, and order events that move stock (created, `received` with items added, cancelled), refetch the public menu and the stock list, and so does catching up after a reconnect: the POS drops sold-out items without a reload; the customer menu re-reads itself every 2 min and when the tab comes back, and those RSC refreshes aren't counted as visits), `hooks/use-notifications-realtime.ts`. Events are only hints; what was missed is read again on reconnect, and also on the window's `online` event (the event stream often doesn't notice a network drop, and the board would wait for its 30 s poll). The tracking page does the same. Weak connections are covered by `e2e/unstable-operations.spec.ts` (lost answers and offline moments on the POS, kitchen and board: one order, one payment, one hand-over) |
| Design system (shadcn base-nova on Base UI) | `components/ui` (generated; change via shadcn CLI) |
| App components (data table, layout, dialogs) | `components/app` |
| Types | aliases of `@react-menu/contracts` in `@types/*.d.ts` and `types/*` |
| Observability | `instrumentation.ts` (`@vercel/otel`, service `react-menu-web`, on only with `OTEL_EXPORTER_OTLP_ENDPOINT`; propagates `traceparent` only to the API's origin, so SSR and the API are one trace; a span processor masks order tracking tokens and OAuth codes in URLs; sampling from `OTEL_TRACES_SAMPLER(_ARG)`); see `docs/development/observability.md` |
| Env schema | `lib/env.ts` (+ `.env.example`) |

## Rules

- Every API call goes through RTK Query (`baseApi`), the session too
  (`redux/features/auth/authApi.ts`); mutations invalidate tags. Endpoints
  can pass `extraOptions`: `quiet` (the screen shows its own errors),
  `session` (a 401 is "signed out", not "expired"), `background`.
- Only a 401 means the session ended; 429/5xx/offline are transient.
  `GET /auth/me` renews a session that is past half its life (new cookie).
- Writes in flight hold navigation (`PendingWritesGuard` in the root
  layout, counter in `lib/pending-writes.ts`): reload/close asks, in-app
  links wait and continue when the save ends. Writes the user doesn't wait
  for (mark as read, push registration) pass `extraOptions: { background: true }`.
- Mutations get an `Idempotency-Key` and automatic retries in `baseApi`.
  Anything a user may resubmit after a dropped connection (checkout, POS)
  passes a `stableIdempotencyKey(scope, payload)` and releases it on success
  (`lib/idempotency.ts`). Use `randomId()`, not `crypto.randomUUID()` (it
  fails on plain-http LAN testing).
- Images: import `Image` from `@/components/app/image` (lint-enforced), never
  `next/image`. Files from the API's `/uploads` skip the optimizer, the rest is
  optimized. Don't set a custom `images.loader`: it disables `/_next/image`.
  Stores without banner/logo show neutral placeholders.
- Base UI: `render` prop for composition; dialogs opened from menu items are
  controlled with state (`open`/`onOpenChange`) instead of nesting triggers;
  confirm destructive actions with `AlertDialogDestructive`.
- Dialogs: header and footer stay fixed and only `DialogBody` scrolls; put
  the form fields inside it (a `<form>` directly under `DialogContent` is
  `display: contents`, so header/body/footer can live inside the form).
  Never put `overflow` on `DialogContent` or use `scrollIntoView` for
  horizontal strips (it scrolls the window too; scroll the strip instead).
- Images go through `components/app/image.tsx` (never `next/image`
  directly). Pass the API's blurred preview as `blurDataURL`
  (`item.photoBlur`, `store.bannerBlur`/`photoBlur`): it turns on
  `placeholder="blur"`, so the image shows its colors while it loads.
  Next's blur is sized by `style.objectFit`, so a contained image (logos)
  passes `style={{ objectFit: "contain" }}`, not the class. Avatars are
  `UserAvatar` / `PhotoAvatar` (`components/app/photo-avatar.tsx`): the
  photo's blur while it loads, the initials if it fails.
- Dialogs never change while they animate closed (it reads as a flicker).
  One opened from a piece of state (`open={Boolean(item)}`) renders from
  `useLastValue(item)` (`hooks/use-last-value.ts`), which keeps the last
  value until the next one. Forms and local state are cleared in
  `onOpenChangeComplete` (Base UI `Dialog`/`AlertDialog`, and
  `AlertDialogDestructive`/`ResponsiveModal`, which maps it to vaul's
  `onAnimationEnd`), never in `onOpenChange` or right before closing.
- The panel asks browsers not to translate it: `app/app/layout.tsx` (meta `google: notranslate` + a `translate="no"` wrapper) and `translate="no"` on `<html>` for `/app` pages (proxy.ts sets `x-panel`, the root layout reads it), so dialogs and toasts rendered outside the panel's tree are covered too. Auto-translation garbles the staff's words and rewrites text React manages, which can break a screen. The customer menu stays translatable.
- Footers pinned to the bottom of a drawer with fields above them (POS ticket, checkout, item customizer) use `tall:sticky tall:bottom-0` (`@custom-variant tall` in `styles/globals.css`: min-height 560px or a mouse, and no `html[data-keyboard]`): with the keyboard open a pinned footer covered the field (the POS ticket's customer name). Android shrinks the page; iOS doesn't, so `components/app/keyboard-watcher.tsx` (root layout) marks `data-keyboard` from `visualViewport`.
- The on-screen keyboard: the viewport has `interactive-widget=resizes-content`
  (app/layout.tsx), so on Android the page shrinks and bottom drawers/bars
  ride above the keyboard. vaul's own repositioning runs only on iOS
  (`components/ui/drawer.tsx`, a local change to the shadcn file: keep it
  when updating) — elsewhere it left drawers stuck up after the keyboard
  closed.
- Menus size to their items: `DropdownMenuContent` is `w-max`, at least the
  trigger's width (or 8rem) and at most the room on screen
  (`components/ui/dropdown-menu.tsx`, a local change to the shadcn file:
  keep it when updating). Give a menu a `min-w-*`, not a fixed `w-*`, so a
  long label doesn't wrap.
- Search fields use `components/app/search-input.tsx` (one clear button,
  Escape clears).
- Base UI `Select` shows the raw value in the trigger unless the root gets
  `items` (`[{ value, label }]`): always pass it.
- Data tables keep page, size, sorting and filters in the URL
  (`hooks/use-url-table-state.ts` via `useTableQuery`): reloads and shared
  links keep the view; filter/sort changes go back to page 1. When writing
  the URL yourself use `history.replaceState(null, …)`: Next only syncs
  `useSearchParams` for app-made entries, not its own state object.
- Desktop tables (`data-table-toolbar.tsx`): the searchable column as a field
  (`data-table-search.tsx`, shared with phones; "/" focuses it), every filter
  beside it, always on screen, "Limpar filtros" while one is set, the count
  on the right. The table sits in one bordered card with its pagination
  ("21–40 de 134", pages by number with "…", "Por página"; a new page
  scrolls back to the list's top); the header sticks while a long page
  scrolls inside it; pinned columns (TanStack `columnPinningFeature`, the
  `pinnedColumns` prop: `{ start, end }` ids, default the first and last
  visible; their measured widths set the offsets, and `DataTableColumnCell`
  applies them through `PinnedCellContext`, so every cell must use it) draw a
  divider while something scrolls under them; the table is a card on the
  page (`bg-card`), lines live on the cells (a row border under opaque pinned
  cells shows in another shade); filter popovers open with a small muted
  title (`PopoverHeading`); the first load shows skeleton rows (cards); rows with
  `onRowClick` take Tab, Enter and the arrows; one empty state for every
  table (filtered: "Limpar busca e filtros"). Server-side tables pass
  `fetching={table.loading}` and `facets={table.facets}`: the API's counts
  per filter option (`meta.facets`, keyed by the API's filter name: the
  config's `key`, "category.name" as `category_name`) go next to each
  option, desktop and phone; an option with none is quieter.
  `useTableQuery` asks for them (`facets` in the list arg, `?facets=1`) on
  the first page only and keeps them for that set of filters across pages;
  while other filters load it shows none rather than stale ones.
- On phones (below 768px, after hydration) the `DataTable` swaps its toolbar
  and pages for `data-table-mobile-toolbar.tsx` and `data-table-load-more.tsx`
  (the root isn't clipped there: overflow would stop the sticky row and cut
  focus rings): one row that sticks under the header (the searchable column
  as a field, "Filtros" as an icon with the count, "Ordenar"), and under it
  the filters in use as chips and the count. "Filtros" opens a drawer built
  from the same `columnsConfig` (options as toggles, the quick periods and a
  calendar on demand, "Exibir como" cartões/tabela; filters apply as picked;
  the content stays while it closes, `useLastValue`). "Ordenar" is a list of
  columns, the chosen one holding its direction in its own words ("Mais
  recentes", "Maior", "A–Z", from the first row's value or the column id).
  The list grows instead of paging: it loads the next 20 by itself near the
  end (the button stays), a thin bar shows how much is on screen, and the end
  offers "Voltar ao topo". It grows the page size on page 1 (kept in the
  URL); pass `maxPageSize` when the API caps `perPage` (orders: 100).
  Nothing per screen changes.
- Tables are TanStack Table 9: features are registered in
  `components/app/data-table/features.ts` (an API exists only if its feature
  is there; client row models and `'auto'` filter/sort functions too) and
  table types come from that module (`ColumnDef<Item>`, `Row<Item>`, …,
  bound to those features; meta via `tableMeta`/`columnMeta`). Read state
  with `table.state` (reactive), never a snapshot (`table.store.state`,
  `atoms.*.get()`), and call row/column methods (`() => column.clearSorting()`):
  they live on prototypes and lose `this` when passed bare.
- Don't center a `Button` with `-translate-y-1/2`: its press effect
  (`active:translate-y-px`) replaces that translate, the button jumps from
  under the pointer and the click is lost. Use `absolute inset-y-0 my-auto`.
- Column headers use `DataTableColumnHeader`, sortable or not: it applies
  `COLUMN_TITLE` (small uppercase, muted). Don't restyle titles per column;
  a custom header (a span) uses `COLUMN_TITLE` too.
- Buttons inside table cells follow the row density: pass
  `size={cellButtonSize(table.options.meta?.density)}`
  (`components/app/data-table/density.ts`).
- Row actions that need page state (dialogs) go through a context the page
  provides, so `columns` stay module-level (see `inventory/components/ingredient-actions.tsx`).
- Forms: react-hook-form + zod + `Field*` components (see
  `create-category-dialog.tsx`); the API validation is authoritative.
  Small whole numbers use `components/app/number-stepper.tsx` (outline −/+
  around a regular `Input`), not a bare `type="number"`.
  Reset buttons ("Limpar", "Desfazer alterações") are enabled only when the
  form changed (`formState.isDirty`, plus a staged photo).
- shadcn conventions (the `.agents/skills/shadcn` rules): `flex flex-col gap-*`
  instead of `space-y-*` (prose like the legal pages is the exception);
  status colors are tokens (`text-success`, `bg-warning/10`, `text-destructive`;
  `--success`/`--warning` in `styles/globals.css`, >= 4.5:1 as text), never
  raw palette classes or `dark:` overrides (identity colors such as the POS
  category accents are the exception); `Spinner` for loading, `Kbd` for keys,
  `Toggle`/`ToggleGroup` for pressed state, `RadioGroup` for one-of choices
  (choice cards: `FieldLabel` > `Field` + `RadioGroupItem`; custom-looking
  options: Base UI `Radio.Root` inside `RadioGroup`), destructive menu items
  with `variant="destructive"`; icons inside components get no size classes.
  Components come from the CLI (`pnpm dlx shadcn@latest add …`, never
  `--overwrite`: `button.tsx` has the app's `loading`).
- User-facing text is pt-BR, including `aria-label`s.
- Theme changes go through `useThemeTransition` (circular reveal from the
  click); `ThemeSegmented` is the compact switch. Inside a view transition,
  always call `setTheme` (not only toggle the class): `@wrksz/themes` puts
  its stored theme back on `<html>` on the next frame. Theme state is
  `@wrksz/themes` (not next-themes): the root `ThemeProvider` comes from
  `@wrksz/themes/next` in `app/layout.tsx`, hooks from `@wrksz/themes/client`.
- Never render a raw `<script>` in a component (React warns and never runs it
  on the client). Pre-hydration scripts go in `components/app/head-scripts.tsx`
  (`useServerInsertedHTML`).
- Error UI: `not-found.tsx` (root, `(menu)/[slug]` for unknown stores,
  `app/app` for the panel via the `app/app/[...missing]` catch-all),
  `error.tsx` (root and `(dashboard)`, inside the shell) and
  `global-error.tsx`, all built on `components/app/status-screen.tsx` /
  `route-error.tsx` (offline message, retries when the connection returns).
- Breadcrumb links: `BreadcrumbLink render={<Link href=… />}` (a plain href
  reloads the whole app).
- Navigation is a `<Link>` styled with `buttonVariants`, not `Button`
  `render={<Link/>}` (Base UI gives it role="button").
- Ingredient emoji use the `font-emoji` class (Noto Color Emoji), so they
  render on devices without an emoji font.

## Tests

Playwright in `e2e/` (`pnpm test:e2e` from the root). It starts the API on
:3334 against a recreated `react-menu-e2e` database and Next on :3100.
Tests fail on any console warning/error, any image that answers 4xx/5xx, and
on unnamed controls.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
