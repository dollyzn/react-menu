# 0005. Type-only shared contracts package

- Status: Accepted
- Date: 2026-10-20

## Context

The web app hand-wrote global types that drifted from the API (e.g. a UUID
typed as `number`, a malformed `Omit` hidden by `skipLibCheck`) and guessed
response shapes. The API validates with VineJS; the web uses zod for forms.

## Decision

`packages/contracts` holds TypeScript types only: the response envelope,
error codes, pagination meta, serialized entities, notification and realtime
event shapes. Both apps import it with `import type` only, enforced by
`@typescript-eslint/no-restricted-imports` (`allowTypeImports`). Runtime
validation stays where it is (VineJS in the API; zod only for form UX).

## Alternatives considered

- **Shared runtime schemas (zod) for both sides**: would replace VineJS or
  duplicate validation; and the API runs compiled JS, so importing a TS
  workspace package at runtime needs a build step for the package.
- **OpenAPI generation / Tuyau**: more automation, more tooling; worth
  revisiting when there are external API consumers.

## Consequences

- Shapes are declared once, but the API's serialized output is not checked
  against them by the compiler; functional tests guard the main shapes.
- No build step for the package; it cannot export values (enums, helpers).
