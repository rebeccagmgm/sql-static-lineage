# Phase 4 target causal overlay

Phase 4 adds a target-write-scoped graph projection over one immutable project
topology snapshot, one matching field-evidence snapshot and one validated
`TARGET_TABLE_UPSTREAM_CAUSAL_CLOSURE` artifact. It does not recompute lineage,
call an external system, infer runtime impact or turn a target-scoped assessment
into a global `CAUSES` fact.

## Scope and authority

The immutable files remain the evidence authority. The overlay loader fails
closed unless all of the following agree exactly:

- project key, project snapshot ID and all four topology publication hashes;
- field snapshot ID and all four field publication hashes;
- target task, physical target table and write observation;
- the target task's multi-hop source SHA-256;
- the field-lineage source SHA-256;
- causal artifact bytes, declared content hash, assessment cardinality and gap
  membership.

The historical producer-index hash remains recorded in the causal artifact but
is not replayed with a newer producer index. This prevents a superficially fresh
artifact assembled from incoherent source generations.

`PROVEN_UNRELATED` and negative proofs remain disabled. Every unresolved branch
must remain `UNKNOWN` with at least one gap. The published snapshot always
retains `runtimeRerunDecision=NOT_EVALUATED`.

## Projection model

The projection is deliberately an overlay, not another global fact graph.

| Node                          | Meaning                                                |
| ----------------------------- | ------------------------------------------------------ |
| `PROJECT_SNAPSHOT_REF`        | Exact immutable Phase 1 source                         |
| `FIELD_EVIDENCE_SNAPSHOT_REF` | Exact immutable Phase 2 source                         |
| `TARGET_WRITE`                | One write observation and physical target              |
| `TASK_REF`                    | Task rollup plus minimum/safety-set membership         |
| `CANDIDATE_BRANCH`            | One candidate branch from the observed universe        |
| `CAUSAL_ASSESSMENT`           | One `targetWriteId + candidateBranchId` decision       |
| `CHANNEL_ASSESSMENT`          | One channel-specific status and its proof/witness/gaps |
| `GAP`                         | Explicit evidence boundary                             |

| Edge                                                  | Meaning                               |
| ----------------------------------------------------- | ------------------------------------- |
| `PROJECT_HAS_TARGET_CAUSAL_OVERLAY`                   | Project snapshot scopes the overlay   |
| `FIELD_EVIDENCE_SUPPORTS_TARGET_WRITE`                | Field snapshot used by the assessment |
| `TARGET_WRITE_OWNED_BY_TASK`                          | Exact target task                     |
| `TARGET_WRITE_HAS_ASSESSMENT`                         | Target-scoped assessment membership   |
| `ASSESSES_BRANCH`                                     | Assessment subject                    |
| `HAS_CHANNEL_ASSESSMENT`                              | Channel decomposition                 |
| `BRANCH_PRODUCED_BY_TASK` / `BRANCH_CONSUMED_BY_TASK` | Task scope, not a causal claim        |
| `*_HAS_GAP`                                           | Explicit unresolved boundary          |

Evidence arrays live on branch, assessment, channel and gap nodes. Edges carry
only relationship semantics, avoiding a second copy of large proof arrays.

## Immutable publication and file queries

Publication is atomic and immutable under:

```text
projects/<projectKey>/target-causal-overlays/<snapshotId>/
  snapshot.json
  target-causal.nodes.jsonl
  target-causal.edges.jsonl
  projection-manifest.json
```

The three file-backed query families are:

- `get_target_causal_overlay`: filter assessments by relation status, channel or
  participating task, then return bounded local context;
- `get_target_causal_task_rollup`: inspect one task's branches, assessments,
  minimum-certain membership and conservative-safety membership;
- `explain_target_causal_assessment`: return one assessment, its branch,
  channels, tasks, gaps and exact source identities.

Example publication:

```text
npm run target-causal-overlay -- publish --topology <absolute-dir> --field <absolute-dir> --causal <absolute-json> --output-root <absolute-dir>
```

## Query-index integration

Phase 3 accepts repeatable `--causal-overlay <absolute-dir>` inputs in addition
to topology and field snapshots. A causal overlay can enter a build only when
its referenced field snapshot is in the same source descriptor. Neo4j remains
a rebuildable index with generic fixed labels; no domain conclusion is written
back to Phase 1, Phase 2 or the causal source.

The source descriptor and index schema are version `1.1.0`. Immutable `1.0.0`
Phase 3 build descriptors remain readable so the previous current build can be
inspected or used as a rollback target. A stale expected descriptor still fails
with `QUERY_INDEX_STALE`.

## 209119 acceptance

Accepted source:

- joint project: `176827 + 181058 + 209119`;
- target write: task `209119`, table `dm_rsk_n.otc_opt_sub_trd_info`, write
  observation `write-observation:209119:platform-target:0`;
- causal source file SHA-256:
  `1ca47fc6a0ed6cf923bc556f71f2758ed0adab5758e23c2263ffadef6edb314e`;
- causal declared content hash:
  `1fe82fc84bc8b87552aa0f73e0b7b5c9792f5e4d3c7325dc190b7da8a4383212`.

Published overlay
`target-causal-overlay-83ddd89c5c90f03d7fd3fe753628daced1ec479f2680a7caa35732b1a84e658d`
contains:

| Metric                                            |                 Result |
| ------------------------------------------------- | ---------------------: |
| Nodes / edges                                     |         5,765 / 13,909 |
| Candidate branches / assessments                  |              542 / 542 |
| `CONFIRMED_RELATED` / `UNKNOWN`                   |               46 / 496 |
| Confirmed channel assessments                     |                     45 |
| Minimum certain tasks / conservative safety tasks |                41 / 78 |
| Explicit gaps                                     |                  1,240 |
| Negative proofs                                   |                      0 |
| Runtime rerun decision                            |        `NOT_EVALUATED` |
| Node / edge bytes                                 | 71,593,588 / 8,727,960 |
| Cold publication / exact reuse                    |    about 2.6 s / 2.2 s |

The isolated Neo4j acceptance indexed the joint topology, all three full-field
snapshots and this causal overlay:

| Metric                              |                Result |
| ----------------------------------- | --------------------: |
| Projections                         |                     5 |
| Indexed nodes / edges               |       29,723 / 43,151 |
| Required full-envelope parity       |        35 / 35 passed |
| Successful cold build / exact reuse |   about 50 s / 10.5 s |
| Activation                          | `READY` and `CURRENT` |
| Previous current retained           |                   yes |
| Stale expected descriptor           |              rejected |

The candidate universe is still incomplete. The acceptance proves that the
causal result is coherent, immutable, queryable and indexable; it does not prove
runtime data change, partition overlap, business correctness or a mandatory
rerun list.

## Deferred business semantic overlay

`BUSINESS_SEMANTIC_OVERLAY` is intentionally not created. There is no approved
ontology owner, authoritative semantic source set or conflict policy in this
phase. Adding labels without those inputs would produce attractive but
unverifiable graph facts.
