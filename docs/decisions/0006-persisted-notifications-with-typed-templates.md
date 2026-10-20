# 0006. Persisted notifications with typed templates

- Status: Accepted
- Date: 2026-10-20

## Context

The web app had push-notification UI calling endpoints that did not exist,
and a notifications popover design existed only as a static example.

## Decision

- Every notification is a row in `notifications` (one per recipient) with
  title, body and url rendered at creation time, so history is stable.
- Kinds are declared in `app/notifications/templates.ts`; the template's
  `data` type is enforced at every `notify()` call.
- Delivery after persistence is best effort: Transmit to
  `users/:id/notifications` and web push (`web-push`, VAPID). Push is a
  no-op without VAPID keys; expired subscriptions (404/410) are pruned.

## Alternatives considered

- **Push/realtime only (no table)**: notifications lost when offline, no
  unread state.
- **Render text on read**: template changes would rewrite history and the
  push payload would differ from the stored one.

## Consequences

- Adding a notification = one template + one call site.
- Preferences per category (mute, email) are not implemented yet.
