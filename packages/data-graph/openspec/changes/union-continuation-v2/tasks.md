## 1. Contract and evidence boundary

- [x] 1.1 Preserve WP-7 1.2.0 `localClosure` in the task-local envelope contract
- [x] 1.2 Keep v1 schema compatibility while rejecting legacy evidence in the v2 entrypoint
- [x] 1.3 Carry projection schema and local closure through union merge evidence

## 2. Three-tier continuation

- [x] 2.1 Add `union-continuation-v2` read-occurrence API
- [x] 2.2 Implement table → partition → write-observation candidate tiers
- [x] 2.3 Implement `partitionMatchStatus` and L1/L2 eligibility
- [x] 2.4 Keep schedule references outside writer selection and all tiers

## 3. Producer-index and verification

- [x] 3.1 Preserve one producer-index writer per `writes[]` observation
- [x] 3.2 Cover 119044's two current 1.2.0 read occurrences
- [x] 3.3 Cover `ASSUMED` L1 exclusion, legacy rejection, and same-table multi-write isolation
- [x] 3.4 Fail-closed on ambiguous 105387 `#3/#6` producer-index alignment
- [x] 3.5 Add current producer-index twenty-scope same-table multi-write sample and L0-L3 envelope checks
- [x] 3.6 Wire v2 continuation into a user-facing batch CLI; CLI only orchestrates loader → merge → v2 trace → envelope and does not change continuation semantics
