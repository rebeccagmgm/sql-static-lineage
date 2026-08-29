# Calcite Semantic Provider POC

This module is the only relation-semantic implementation in the POC path.
It consumes bounded SQL plus a concrete schema, validates it with Calcite
1.42.0, converts it to an unoptimized `RelNode` tree and emits normalized
candidate facts. It does not read Multi-hop or write canonical lineage
artifacts.

The TypeScript side may validate, cache, map evidence and query these facts;
it must not reconstruct JOIN/FILTER/AGGREGATE semantics.

The completed POC decision is `VALIDATION_ONLY`: direct SQL extraction and
resource gates pass, but evaluated dependencies are not yet exactly mapped to
Native occurrence/source-span evidence. See the OpenSpec `poc-result.md`.

Historical `scripts/calcite-oracle/` and `tools/calcite-rel-bridge/` code is not
invoked by this Provider. The TypeScript compatibility types remain only
because existing target-field and differential tests still import their public
shape; they are not a fallback semantic provider for this POC.
