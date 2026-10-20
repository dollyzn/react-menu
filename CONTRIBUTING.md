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

## Changing architecture

Decisions that are hard to reverse need an ADR in `docs/decisions/`. Update
`AGENTS.md` and `docs/architecture/` in the same PR when conventions change.

## Code of conduct

Be respectful and constructive. Harassment is not tolerated; maintainers may
remove content or block participants who don't follow this.
