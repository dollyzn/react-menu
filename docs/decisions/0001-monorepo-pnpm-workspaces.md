# 0001. Monorepo with pnpm workspaces, no Turborepo

- Status: Accepted
- Date: 2026-10-20

## Context

The API and the web app lived in two repositories with separate lockfiles,
Node versions (20 vs 24) and duplicated, drifting types. Contributors had to
clone and configure both, and cross-cutting changes (API + UI) could not be
reviewed together.

## Decision

One repository with pnpm workspaces: `apps/api`, `apps/web`,
`packages/contracts`. Both old repositories were imported with
`git subtree` so their history is preserved. Root scripts run per-package
scripts recursively (`pnpm -r --if-present`). One lockfile, one `.nvmrc`.

Only packages with a real consumer exist: no `packages/ui` (there is one
frontend) and no `packages/config`/`utils` (nothing to share yet).

## Alternatives considered

- **Turborepo / Nx**: task caching and graph scheduling pay off with many
  packages; with two apps and one types package, `pnpm -r` is enough and
  adds no tooling to learn. Revisit if CI time or package count grows.
- **Keep two repositories**: no shared types or atomic changes.

## Consequences

- Workspace isolation surfaced phantom dependencies (e.g. `framer-motion`
  imported but not declared), now fixed.
- Deploys are per app: the web workflow is path-filtered; the API is
  deployed with `pnpm deploy --filter @react-menu/api` (its own lockfile is
  gone, so `node ace build` alone is not enough).
