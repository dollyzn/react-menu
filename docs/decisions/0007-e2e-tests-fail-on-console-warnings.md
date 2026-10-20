# 0007. E2E tests fail on browser console warnings

- Status: Accepted
- Date: 2026-10-20

## Context

Base UI warnings (e.g. a trigger expecting a native `<button>`), hydration
mismatches and React warnings were only noticed by chance in the console.

## Decision

The Playwright fixture records console warnings/errors and page errors and
fails the test if any appear (expected HTTP error responses are ignored).
An accessibility test fails on interactive elements without an accessible
name.

## Alternatives considered

- **Manual review / lint only**: static checks cannot see runtime warnings.
- **Suppressing warnings**: hides real semantic/a11y defects.

## Consequences

- New dev-only console noise must be fixed or explicitly allow-listed in
  `apps/web/e2e/fixtures.ts` with a reason.
