@AGENTS.md

## Claude Code notes

- Scoped guides load automatically: `apps/api/CLAUDE.md` and `apps/web/CLAUDE.md`.
- `apps/web/.agents/skills/` has the shadcn and Vercel React best-practices
  skills; follow them for UI work, but the Base UI rules in AGENTS.md win.
- Skills shipped by dependencies (TanStack Table 9) are linked into
  `.claude/skills/` by `pnpm install` (`skills.dirs` and `permissions` in
  `pnpm-workspace.yaml`; approve new ones with `pnpm approve`). They are
  ignored by git and follow the installed version.
- Before finishing a change, run `pnpm check`; run `pnpm test:e2e` when you
  touch auth, realtime, dialogs/menus or CRUD screens.
- Never run `next build` or `next dev` against a `.next/` folder that holds
  files you did not create.
