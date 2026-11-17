# Contributing

Thanks for helping! Issues and pull requests are welcome.

## Before you start

- For anything beyond a small fix, open an issue first to agree on the
  approach, especially for new features from the roadmap.
- Read [AGENTS.md](AGENTS.md): it lists the conventions reviewers check
  (authorization, contracts, response envelope, realtime, Base UI).

## Workflow

1. Fork and create a branch from `main` (`feat/...`, `fix/...`).
2. Follow the setup in the [README](README.md).
3. Make the change with tests:
   - API: a functional test in `apps/api/tests/functional`, including the
     unauthorized / other-store case for protected endpoints.
   - Web: an e2e test in `apps/web/e2e` for critical flows.
4. Run `pnpm check` (and `pnpm test:e2e` for UI/auth/realtime changes).
5. Commit with [Conventional Commits](https://www.conventionalcommits.org)
   (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `ci:`; `!` = breaking).
6. Open a PR using the template; CI must pass.

## Pull requests and releases

PR descriptions and release notes describe the change as it ships, for
someone who didn't follow the work. Write them in English, in plain words
from the user's side ("the search is a field", not "renders SearchInput").

### Pull request description

Use these sections, in this order (the template has them):

- `## Why`: the problem, in one short paragraph (what got in the way, and
  for whom).
- `## What`: what changes, grouped by area, as bullets with a bold lead
  (`- **Toolbar**: ...`). Describe the final state only. Fixes found while
  reviewing your own branch are part of the change: fold them into the
  bullets they belong to. Don't add "Review", "Review fixes" or tool
  sections (no `/code-review`, no "a review found 8 issues"), and don't
  tell the story of the commits. Something left out on purpose goes in one
  closing line ("Not done: ...").
- `## Tests`: the tests added or changed (what they cover, not their
  names only) and what passed (`pnpm check`, the e2e suite).
- `## Deploy notes`: migrations (name and what they do), new environment
  variables, one-off commands to run after the deploy. If there are none,
  say so: "No migrations or new environment variables." Web-only changes
  say "Web only."

A follow-up to an open PR updates its description in place; it doesn't
add an "Update" section.

### Release notes

A release is published from `main` with the next version tag (`vX.Y.Z`;
minor for new features, patch for fixes and security updates), and it
deploys (`.github/workflows/deploy.yml`). Its notes use:

- `## New`, `## Changed`, `## Fixed`, `## Security`: only the ones that
  apply. One bullet per change, with a bold name and the PR number
  (`- **Orders board** (#101): ...`), in what the store's staff see.
- `## Deploy notes`: as in the PR. Repeat migrations and the commands to
  run after the deploy, or "No migrations or new environment variables."

Leave out how the change was reviewed or tested; that belongs to the PR.

## Changing architecture

Decisions that are hard to reverse need an ADR in `docs/decisions/`. Update
`AGENTS.md` and `docs/architecture/` in the same PR when conventions change.

## Code of conduct

Be respectful and constructive. Harassment is not tolerated; maintainers may
remove content or block participants who don't follow this.
