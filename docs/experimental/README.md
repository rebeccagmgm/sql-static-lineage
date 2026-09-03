# Experimental / paused work

Code under `scripts/reconcile/consumer/target-table-upstream-causal-closure/` remains
for regression and optional CLI use. It is **not** the current product mainline.

## WP-10 `closure-on-union` (paused 2026-09-03)

- **Status**: paused; do not extend for L1-count KPIs or legacy-closure diff gates.
- **OpenSpec archive**:
  `openspec/changes/archive/2026-09-03-closure-on-union-paused/`
- **Execution plan (historical)**:
  `docs/experimental/execution-plan-closure-on-union.md`
  （旧路径 `docs/execution-plan-closure-on-union.md` 为重定向桩）
- **Still useful**: union-v2 attachment + `UNION_CONTINUATION_INDEX` adapter as a
  library; **case-first continuation** should use a thin WP-8 slice only.

## Current mainline (2026-09-03)

Gold-case investigation for `105387 → 119044 → 176827`:

- task-local projection + minimal cross-task continuation
- machine-graph HTML under `scripts/visualize/` (`npm run visualize-task-local-machine-graph`)
- L0–L3 narrative on the investigation page (WP-12 V0), not closure tier counts
