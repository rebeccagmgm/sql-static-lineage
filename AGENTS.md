# Repository workflow

This repository is commonly used from linked Git worktrees. A worktree does
not share ignored directories such as `node_modules` with its siblings.

Before running project checks, use the npm scripts below. Their `pre*` hooks
automatically install the locked dependencies when the current worktree is
new or incomplete:

- `npm test`
- `npm run typecheck`
- `npm run build`
- `npm run format:check`
- `npm run inspect`

For dependency-only setup, run `npm run prepare:deps`. Do not use `npx` for
project validation, because it can resolve a package outside the lockfile or
hide that the current worktree has not been initialized.
