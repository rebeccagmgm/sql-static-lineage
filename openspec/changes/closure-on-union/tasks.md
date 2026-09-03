## 1. Contracts and adapter

- [x] 1.1 Add optional `CandidateBranch.continuation` and typed union-v2 continuation stats without changing legacy serialization.
- [x] 1.2 Implement strict `UNION_CONTINUATION_INDEX` 1.0.0 parsing and exact `candidatesForRead(consumerTaskId, readOccurrenceId)` lookup.

## 2. Union-v2 attachment

- [x] 2.1 Add CLI parsing for `--candidate-source` and `--continuation-index`, keeping legacy as the default.
- [x] 2.2 Attach indexed candidates to existing multi-hop physical bridges with exact write-scope binding, DISJOINT pruning, and schedule-only suppression.
- [x] 2.3 Apply continuation certainty caps and evidence/gap references during closure propagation.
- [x] 2.4 Emit evidence-bounded continuation and bridge counts, including true read-level ambiguity and unmatched-read counts.

## 3. Verification

- [x] 3.1 Add adapter, synthetic multi-hop, 119044, and 105387 regression coverage, including the no-`:0` invariant.
- [x] 3.2 Run target closure tests, typecheck, build, and the legacy compatibility/hash check; record known C2+ limitations.

## 4. C2 follow-up: closure-on-union

- [x] 4.1 Make the union-v2 physical-producer universe INDEX-driven, retaining only multi-hop read/boundary scope and failing closed on unmatched reads.
- [x] 4.2 Cap legacy field-lineage at CONDITIONAL/L2 and gate union-v2 `valueCertain` on INDEX L1 continuation plus current Facts local closure.
- [x] 4.3 Emit and validate a machine-readable closure diff v0 for same-target legacy/union-v2 runs, with shrink reason codes and the 176827 tier-one anchor.
- [ ] 4.4 Refresh a real 176827 UNION_CONTINUATION_INDEX with occurrence identities aligned to the current multi-hop/Facts snapshot and full closure coverage. The available artifact has only 16 entries for consumer 119044 (two projected task inputs); after proven alias alignment the run reaches 27 physical candidates but still has 118 unmatched reads and `l1=0`, so it is input-blocked and not an acceptance result.
