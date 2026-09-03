## Contract

`UNION_CONTINUATION_INDEX` 1.0.0 contains:

- input batch manifest, producer-index identity, and only preflight-passing
  `PROJECTED` task projection references;
- one entry per `(consumerTaskId, readOccurrenceId)`;
- the read occurrence identity and partition predicate status;
- every table/partition candidate with its write observation identity, source,
  partition evidence, `partitionMatchStatus`, evidence layer, and L1 flag;
- pruned write observations and read-level gaps with reason codes.

The content hash uses canonical JSON and excludes only `generatedAt`, matching
the existing continuation evidence envelope rule.

## Preflight and Boundary

The CLI loads and validates the complete batch before creating the output
directory. Any `PROJECTED` task whose projection schema is not `1.2.0` fails the
entire run. Boundary-only tasks are not index entries and cannot be supplied as
v2 consumers.

The index carries the result of the existing WP-8 v2 kernel. It does not call
`producer-index-query`, implement partition matching, or convert schedule
references into producer candidates. Consumers must treat the index as the
authoritative WP-8 state and filter `DISJOINT` candidates out of their own
candidate universe.

## Replay

The output directory contains `union-continuation-index.json` and
`manifest.json`. Both are validated after writing. The manifest records the
index hash, selected consumers, projected task count, and read-occurrence count.
