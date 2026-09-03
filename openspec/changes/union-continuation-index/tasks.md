## 0. OpenSpec

- [x] 0.1 Add `.openspec.yaml` and `specs/union-continuation-index/spec.md` deltas

## 1. Index contract

- [x] 1.1 Add `UNION_CONTINUATION_INDEX` 1.0.0 types and content hash
- [x] 1.2 Preserve read/write node identity, partition evidence, and gaps
- [x] 1.3 Assert unique consumer/read and task/write keys

## 2. CLI

- [x] 2.1 Add `union-continuation-index` npm entrypoint
- [x] 2.2 Preflight all `PROJECTED` inputs as 1.2.0 before v2 tracing
- [x] 2.3 Exclude `SCHEDULE_ONLY` and `COLLECTION_FAILED` from entries
- [x] 2.4 Write and revalidate index plus manifest

## 3. Verification

- [x] 3.1 Add CLI fixture coverage for all projected reads and input rejection
- [x] 3.2 Run current 119044 / 105387 1.2.0 batch and record output hashes

Verification snapshots (generated under ignored `tmp/` paths): 119044-only
index `a4373adcd985acee366021712b8cf2e3d90a99b673d506c37be476352c486889`;
combined current 119044 + 105387 index
`a6dc35802e172def104d2ad88bdc14617bf1689c9ca11b5b864f2f253b2beeb6`.
