# 0023. Store assistant on the AI SDK, with each store's own model

- Status: Accepted
- Date: 2026-11-19

## Context

Managers ask the panel questions that take several screens to answer ("how
did the weekend compare to the last one?", "what runs out on Saturday?", "who
owes us?"), and some changes are repetitive by hand ("R$ 2 more on every sweet
pastry", "pause the shrimp one"). A chat assistant in the panel can answer
from the store's own data and make those changes, as long as it never invents
numbers, never acts outside the person's role and never changes anything
without the person seeing what will change first.

Stores pay for their own model usage, and they don't all want the same
provider. The panel's chat should follow shadcn's AI Elements patterns, which
are built for the Vercel AI SDK's UI message protocol (`useChat`).

## Decision

- **Vercel AI SDK on both ends, no gateway.** The API runs `streamText` and
  answers the AI SDK UI message stream (SSE) that `useChat` reads. Models
  come from `createProviderRegistry` with the official providers for
  Anthropic, OpenAI and Google, built per request with the store's key
  (`#assistant/models`). Vercel's AI Gateway is not used.
- **Per store, like Mercado Pago.** Managers connect providers in the store
  page's "Assistente" tab with the store's own keys (`stores.assistant_keys`,
  one encrypted JSON with a key per provider, never serialized; the store
  says only which providers have one), choose the models offered in the chat
  (`assistant_models`: provider, model id, name and context window) and the
  default one (`PUT /stores/:id/assistant-settings`). A key is tested by
  listing its models before it is saved (`POST …/assistant-settings/models`,
  the key in the body), which also gives the context window where the
  provider says (Anthropic, Google). Whoever chats picks one of the store's
  models per message; without a usable model the assistant is off.
- **Tools over the existing services**, scoped by the session's store and
  role (`#assistant/tools`): sales, an item's sales, stock forecast, today's
  board, order history, open "Pagar depois", menu items; writes: prices and
  availability (through the bulk edit and its `updatedAt` check), stock
  movements, new menu items (paused), choice groups (their rule and options,
  a copy for some items in the original's place, groups and add-ons put on
  or taken off items; a group is shared, so the tools say how many items
  use it). The same tool list goes to everyone and
  each call checks the role again, so attendants get "Sem permissão" instead
  of data. Attendants get what their screens show: today's orders, the menu
  and whether the store is open; stock, reports and opening or closing the
  store are the managers', as in the panel. Inputs are validated with VineJS. Phone numbers leave masked.
- **Writes wait for approval.** `toolApproval` stops the turn and the panel
  shows what will change (a `data-approval` part, read from the database).
  Approving or declining is the AI SDK's approval response; the API applies
  the answers only to parts still waiting, so a repeated approval runs
  nothing. A new message declines what was left unanswered (the panel shows
  it so). An answer whose changes went through can't be generated again
  (409 `E_ASSISTANT_CHANGED`): the model would make them twice.
- **The API keeps the conversation** (`assistant_conversations.ui_messages`,
  AI SDK UI messages with the providers' reasoning metadata); the client
  sends only its newest message. Conversations belong to one person in one
  store. Each message carries a context block (store, person, role, time,
  screen) in its metadata, so earlier turns never change and stay cached.
  One request per conversation at a time (`busy_until`).
- **Daily limit per store** (`ASSISTANT_DAILY_LIMIT`, default 200 questions a
  business day; answering an approval doesn't count), counted in
  `assistant_usages`, which also keeps the tokens
  (input, cached, output, reasoning). Each answer's metadata carries its
  model, tokens and the last call's input (how full the context is), and the
  server times each thought (the AI SDK doesn't) for "Pensou por 4s".
- **Cost estimate in US$** in the settings (`GET …/assistant-costs`): the
  saved tokens times public list prices (`#assistant/pricing`, matched by
  model id prefix), or a price the store sets per model. It is an estimate;
  the provider's bill is what counts, and the list needs updating as
  providers retire models.
- **Next questions**: after an answer (not while a change waits), the panel
  asks for three follow-ups written by the same model from the last turns
  (`POST …/conversations/:id/suggestions`, a short `generateText` with a
  structured output); outside the daily limit, its tokens in the cost.
  Without them, the panel's own varied suggestions per screen stay.
- **Development and e2e** use a scripted model (`ASSISTANT_FAKE_MODEL`,
  ignored in production) that calls the same tools by keyword; there,
  `fake-…` keys connect without asking a provider.

## Alternatives considered

- **A provider's own SDK (Anthropic's) with a hand-written stream.** It gives
  every provider feature first, but ties the stores to one provider and means
  writing the UI protocol and the approval flow ourselves.
- **Vercel's AI Gateway.** One key for every model, but a third party in the
  middle of every request and its own billing; stores would not use their
  own accounts.
- **Letting the model change data directly.** Faster, but a wrong id or
  price would reach the menu before anyone saw it.

## Consequences

- Each store needs an account with a provider; the cost goes there.
- Provider-specific options (Claude's adaptive thinking and refusal
  fallbacks, OpenAI's reasoning summaries, Gemini's thoughts) are set per
  provider in `AssistantModels.providerOptions`.
- Questions, answers and tool results (sales, names, masked phones) go to the
  store's chosen provider; the privacy policy should say so.
- New tools go in `#assistant/tools` (schema, VineJS validator, roles, and
  `approval` for writes) and get a card in the panel
  (`components/app/assistant/tool-cards.tsx`).
