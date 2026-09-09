# Task-lineage add-on

This directory contains the early, target-oriented lineage experiment that was
previously spread across `reconcile/consumer`, `pipeline`, `project-graph`,
`gold-case`, and `visualize`.

It is not part of the formal data-graph production path. The formal path remains:

```text
Input Pack -> SQL/Plan -> Machine Facts -> task-local -> continuation
  -> data-graph prepare/publish -> CLI/HTTP/React
```

The add-on keeps the existing one-hop, multi-hop, per-root field-lineage,
field-impact query, autofill/closure, and HTML visualization behavior. Its
artifact names, default output locations, schemas, and evidence semantics are
unchanged. Root npm commands are deliberately namespaced as
`addon:task-lineage:*`; the former unprefixed product commands are no longer
formal entry points.

Shared contracts required by the formal path stay outside this directory:

- `scripts/evidence/schedule-evidence-cache.ts`
- `scripts/reconcile/shared/terminal-table-config.ts`
- `scripts/reconcile/shared/source-endpoint-boundary-config.ts`
- `scripts/reconcile/shared/producer-table-identity.ts`
- `scripts/reconcile/shared/physical-field.ts`
- `scripts/project-graph/task-local/field-expression-dependencies.ts`
- `packages/data-graph/src/continuation/`

The formal `project-task-local` command no longer activates upstream expansion.
Use `npm run addon:task-lineage:project-task-local -- ...` for that opt-in path.
