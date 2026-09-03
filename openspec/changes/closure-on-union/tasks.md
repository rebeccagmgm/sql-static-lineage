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
